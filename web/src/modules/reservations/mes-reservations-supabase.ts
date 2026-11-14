import type { SupabaseClient } from "@supabase/supabase-js";

export interface ReservationAffichee {
  reference: string;
  statut: string;
  creeAt: Date;
  debutSeance: Date | null;
  film: string;
}

interface LigneReservation {
  reference: string;
  statut: string;
  cree_at: string;
  seance: { debut_at: string; film: { titre: string } | null } | null;
}

/** Réservations rattachées au compte connecté (E6, espace client). */
export async function listerReservationsDe(
  client: SupabaseClient,
  utilisateurId: string,
): Promise<ReservationAffichee[]> {
  const { data, error } = await client
    .from("reservation")
    .select("reference, statut, cree_at, seance:seance_id (debut_at, film:film_id (titre))")
    .eq("utilisateur_id", utilisateurId)
    .order("cree_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(`Lecture des réservations impossible : ${error.message}`);
  return ((data ?? []) as unknown as LigneReservation[]).map((ligne) => ({
    reference: ligne.reference,
    statut: ligne.statut,
    creeAt: new Date(ligne.cree_at),
    debutSeance: ligne.seance ? new Date(ligne.seance.debut_at) : null,
    film: ligne.seance?.film?.titre ?? "Film inconnu",
  }));
}
