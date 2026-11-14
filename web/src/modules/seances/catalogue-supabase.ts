import type { SupabaseClient } from "@supabase/supabase-js";

export interface SeanceAffichee {
  id: number;
  debutAt: Date;
  version: string;
  prixCentimes: number;
  statut: string;
  film: string;
  dureeMinutes: number;
  salle: string;
}

export interface Choix {
  id: number;
  libelle: string;
}

interface LigneSeance {
  id: number;
  debut_at: string;
  version: string;
  prix_centimes: number;
  statut: string;
  film: { titre: string; duree_minutes: number } | null;
  salle: { nom: string } | null;
}

const COLONNES =
  "id, debut_at, version, prix_centimes, statut, film:film_id (titre, duree_minutes), salle:salle_id (nom)";

function versSeance(ligne: LigneSeance): SeanceAffichee {
  return {
    id: ligne.id,
    debutAt: new Date(ligne.debut_at),
    version: ligne.version,
    prixCentimes: ligne.prix_centimes,
    statut: ligne.statut,
    film: ligne.film?.titre ?? "Film inconnu",
    dureeMinutes: ligne.film?.duree_minutes ?? 0,
    salle: ligne.salle?.nom ?? "Salle inconnue",
  };
}

/** Séances à venir : publiées seulement pour le public (E1), toutes pour la programmation (E7). */
export async function listerSeancesAVenir(
  client: SupabaseClient,
  options: { publieesSeulement: boolean },
): Promise<SeanceAffichee[]> {
  let requete = client
    .from("seance")
    .select(COLONNES)
    .gt("debut_at", new Date().toISOString())
    .order("debut_at")
    .limit(100);
  if (options.publieesSeulement) requete = requete.eq("statut", "publiee");
  const { data, error } = await requete;
  if (error) throw new Error(`Lecture des séances impossible : ${error.message}`);
  return ((data ?? []) as unknown as LigneSeance[]).map(versSeance);
}

/** Films et salles actifs, pour les listes du formulaire de programmation. */
export async function listerChoixProgrammation(
  client: SupabaseClient,
): Promise<{ films: Choix[]; salles: Choix[] }> {
  const [films, salles] = await Promise.all([
    client.from("film").select("id, titre, duree_minutes").eq("actif", true).order("titre"),
    client.from("salle").select("id, nom").eq("actif", true).order("nom"),
  ]);
  if (films.error) throw new Error(`Lecture des films impossible : ${films.error.message}`);
  if (salles.error) throw new Error(`Lecture des salles impossible : ${salles.error.message}`);
  return {
    films: (films.data as { id: number; titre: string; duree_minutes: number }[]).map((f) => ({
      id: f.id,
      libelle: `${f.titre} (${f.duree_minutes} min)`,
    })),
    salles: (salles.data as { id: number; nom: string }[]).map((s) => ({
      id: s.id,
      libelle: s.nom,
    })),
  };
}
