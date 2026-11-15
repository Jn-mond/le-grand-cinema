import type { SupabaseClient } from "@supabase/supabase-js";
import type { DepotPublication, EtatSeance, StatutSeance } from "./publication";

export class DepotPublicationSupabase implements DepotPublication {
  constructor(private readonly client: SupabaseClient) {}

  async lireSeance(seanceId: number): Promise<EtatSeance | null> {
    const { data, error } = await this.client
      .from("seance")
      .select("statut, debut_at")
      .eq("id", seanceId)
      .maybeSingle();
    if (error) throw new Error(`Lecture de la séance impossible : ${error.message}`);
    if (!data) return null;
    const ligne = data as { statut: StatutSeance; debut_at: string };
    return { statut: ligne.statut, debutAt: new Date(ligne.debut_at) };
  }

  async placesOccupees(seanceId: number, maintenant: Date): Promise<number> {
    const [verrous, billets] = await Promise.all([
      this.client
        .from("verrou_place")
        .select("place_id", { count: "exact", head: true })
        .eq("seance_id", seanceId)
        .gt("expire_at", maintenant.toISOString()),
      this.client
        .from("billet")
        .select("id", { count: "exact", head: true })
        .eq("seance_id", seanceId)
        .in("statut", ["valide", "utilise"]),
    ]);
    if (verrous.error) throw new Error(`Lecture des verrous impossible : ${verrous.error.message}`);
    if (billets.error) throw new Error(`Lecture des billets impossible : ${billets.error.message}`);
    return (verrous.count ?? 0) + (billets.count ?? 0);
  }

  async changerStatut(
    seanceId: number,
    de: StatutSeance,
    vers: StatutSeance,
    maintenant: Date,
  ): Promise<boolean> {
    // La condition sur l'ancien statut et la date rend la mise à jour sûre face à un double envoi.
    const { data, error } = await this.client
      .from("seance")
      .update({ statut: vers })
      .eq("id", seanceId)
      .eq("statut", de)
      .gt("debut_at", maintenant.toISOString())
      .select("id");
    if (error) throw new Error(`Changement de statut impossible : ${error.message}`);
    return (data ?? []).length === 1;
  }
}
