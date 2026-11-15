import type { SupabaseClient } from "@supabase/supabase-js";

export interface FicheFilm {
  id: number;
  titre: string;
  titreOriginal: string | null;
  synopsis: string | null;
  dureeMinutes: number;
  ageMinimum: number;
  /** Date sans heure, au format AAAA-MM-JJ. */
  dateSortie: string | null;
  afficheUrl: string | null;
  genres: string[];
}

interface LigneFilm {
  id: number;
  titre: string;
  titre_original: string | null;
  synopsis_fr: string | null;
  duree_minutes: number;
  age_minimum: number;
  date_sortie: string | null;
  affiche_url: string | null;
  film_genre: { genre: { nom: string } | null }[] | null;
}

/** E1 — un film actif du catalogue avec ses genres, ou null s'il n'existe pas ou est retiré. */
export async function lireFicheFilm(
  client: SupabaseClient,
  filmId: number,
): Promise<FicheFilm | null> {
  const { data, error } = await client
    .from("film")
    .select(
      "id, titre, titre_original, synopsis_fr, duree_minutes, age_minimum, date_sortie, affiche_url, film_genre (genre (nom))",
    )
    .eq("id", filmId)
    .eq("actif", true)
    .maybeSingle();
  if (error) throw new Error(`Lecture du film impossible : ${error.message}`);
  if (!data) return null;
  const ligne = data as unknown as LigneFilm;
  return {
    id: ligne.id,
    titre: ligne.titre,
    titreOriginal: ligne.titre_original,
    synopsis: ligne.synopsis_fr,
    dureeMinutes: ligne.duree_minutes,
    ageMinimum: ligne.age_minimum,
    dateSortie: ligne.date_sortie,
    afficheUrl: ligne.affiche_url,
    genres: (ligne.film_genre ?? [])
      .map((lien) => lien.genre?.nom)
      .filter((nom): nom is string => Boolean(nom))
      .sort((a, b) => a.localeCompare(b, "fr")),
  };
}
