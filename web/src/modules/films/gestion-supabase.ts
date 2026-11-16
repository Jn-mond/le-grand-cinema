import type { SupabaseClient } from "@supabase/supabase-js";
import type { Choix } from "../seances/catalogue-supabase";
import type { DepotGestionFilms, FilmSaisi } from "./gestion";

/** Code levé par enregistrer_film() quand la durée d'un film programmé change (migration 0007). */
const DUREE_VERROUILLEE = "LGC01";

export class DepotGestionFilmsSupabase implements DepotGestionFilms {
  constructor(private readonly client: SupabaseClient) {}

  async genresExistants(ids: number[]): Promise<number[]> {
    const { data, error } = await this.client.from("genre").select("id").in("id", ids);
    if (error) throw new Error(`Lecture des genres impossible : ${error.message}`);
    return (data as { id: number }[]).map((genre) => genre.id);
  }

  async enregistrer(
    film: FilmSaisi,
    id: number | null,
  ): Promise<number | "introuvable" | "duree_verrouillee"> {
    const { data, error } = await this.client.rpc("enregistrer_film", {
      p_id: id,
      p_titre: film.titre,
      p_titre_original: film.titreOriginal,
      p_duree_minutes: film.dureeMinutes,
      p_age_minimum: film.ageMinimum,
      p_date_sortie: film.dateSortie,
      p_synopsis_fr: film.synopsis,
      p_affiche_url: film.afficheUrl,
      p_actif: film.actif,
      p_genres: film.genres,
    });
    if (error?.code === DUREE_VERROUILLEE) return "duree_verrouillee";
    if (error) throw new Error(`Enregistrement du film impossible : ${error.message}`);
    return data === null ? "introuvable" : Number(data);
  }
}

/** Un film de la liste de gestion (actif ou non). */
export interface FilmGere {
  id: number;
  titre: string;
  dureeMinutes: number;
  ageMinimum: number;
  dateSortie: string | null;
  actif: boolean;
  genres: string[];
}

/** Valeurs d'un film à modifier, telles qu'elles préremplissent le formulaire. */
export interface FilmEditable {
  id: number;
  titre: string;
  titreOriginal: string | null;
  dureeMinutes: number;
  ageMinimum: number;
  dateSortie: string | null;
  synopsis: string | null;
  afficheUrl: string | null;
  actif: boolean;
  genres: number[];
}

/** E7 — tous les films, actifs ou non, avec leurs genres, par titre. */
export async function listerFilmsGeres(client: SupabaseClient): Promise<FilmGere[]> {
  const { data, error } = await client
    .from("film")
    .select("id, titre, duree_minutes, age_minimum, date_sortie, actif, film_genre (genre (nom))")
    .order("titre");
  if (error) throw new Error(`Lecture des films impossible : ${error.message}`);
  const lignes = data as unknown as {
    id: number;
    titre: string;
    duree_minutes: number;
    age_minimum: number;
    date_sortie: string | null;
    actif: boolean;
    film_genre: { genre: { nom: string } | null }[] | null;
  }[];
  return lignes.map((ligne) => ({
    id: ligne.id,
    titre: ligne.titre,
    dureeMinutes: ligne.duree_minutes,
    ageMinimum: ligne.age_minimum,
    dateSortie: ligne.date_sortie,
    actif: ligne.actif,
    genres: (ligne.film_genre ?? [])
      .map((lien) => lien.genre?.nom)
      .filter((nom): nom is string => Boolean(nom))
      .sort((a, b) => a.localeCompare(b, "fr")),
  }));
}

/** E7 — un film à modifier, actif ou non, ou null s'il n'existe pas. */
export async function lireFilmEditable(
  client: SupabaseClient,
  filmId: number,
): Promise<FilmEditable | null> {
  const { data, error } = await client
    .from("film")
    .select(
      "id, titre, titre_original, duree_minutes, age_minimum, date_sortie, synopsis_fr, affiche_url, actif, film_genre (genre_id)",
    )
    .eq("id", filmId)
    .maybeSingle();
  if (error) throw new Error(`Lecture du film impossible : ${error.message}`);
  if (!data) return null;
  const ligne = data as unknown as {
    id: number;
    titre: string;
    titre_original: string | null;
    duree_minutes: number;
    age_minimum: number;
    date_sortie: string | null;
    synopsis_fr: string | null;
    affiche_url: string | null;
    actif: boolean;
    film_genre: { genre_id: number }[] | null;
  };
  return {
    id: ligne.id,
    titre: ligne.titre,
    titreOriginal: ligne.titre_original,
    dureeMinutes: ligne.duree_minutes,
    ageMinimum: ligne.age_minimum,
    dateSortie: ligne.date_sortie,
    synopsis: ligne.synopsis_fr,
    afficheUrl: ligne.affiche_url,
    actif: ligne.actif,
    genres: (ligne.film_genre ?? []).map((lien) => lien.genre_id),
  };
}

/** Genres proposés dans le formulaire, par nom. */
export async function listerGenres(client: SupabaseClient): Promise<Choix[]> {
  const { data, error } = await client.from("genre").select("id, nom").order("nom");
  if (error) throw new Error(`Lecture des genres impossible : ${error.message}`);
  return (data as { id: number; nom: string }[]).map((genre) => ({
    id: genre.id,
    libelle: genre.nom,
  }));
}
