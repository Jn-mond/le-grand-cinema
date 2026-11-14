import type { SupabaseClient } from "@supabase/supabase-js";
import type { DepotProgrammation, NouvelleSeance } from "./programmation";

/** Code PostgreSQL d'une violation de contrainte d'exclusion (seance_pas_de_chevauchement). */
const VIOLATION_EXCLUSION = "23P01";

export class DepotProgrammationSupabase implements DepotProgrammation {
  constructor(private readonly client: SupabaseClient) {}

  async dureeFilm(filmId: number): Promise<number | null> {
    const { data, error } = await this.client
      .from("film")
      .select("duree_minutes")
      .eq("id", filmId)
      .eq("actif", true)
      .maybeSingle();
    if (error) throw new Error(`Lecture du film impossible : ${error.message}`);
    return data ? (data as { duree_minutes: number }).duree_minutes : null;
  }

  async salleExiste(salleId: number): Promise<boolean> {
    const { data, error } = await this.client
      .from("salle")
      .select("id")
      .eq("id", salleId)
      .eq("actif", true)
      .maybeSingle();
    if (error) throw new Error(`Lecture de la salle impossible : ${error.message}`);
    return data !== null;
  }

  async creer(seance: NouvelleSeance): Promise<{ id: number } | "chevauchement"> {
    const { data, error } = await this.client
      .from("seance")
      .insert({
        film_id: seance.filmId,
        salle_id: seance.salleId,
        debut_at: seance.debutAt.toISOString(),
        fin_at: seance.finAt.toISOString(),
        version: seance.version,
        prix_centimes: seance.prixCentimes,
        statut: seance.statut,
      })
      .select("id")
      .single();
    if (error?.code === VIOLATION_EXCLUSION) return "chevauchement";
    if (error) throw new Error(`Création de la séance impossible : ${error.message}`);
    return { id: (data as { id: number }).id };
  }
}
