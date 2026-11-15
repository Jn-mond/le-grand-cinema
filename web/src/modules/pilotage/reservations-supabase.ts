import type { SupabaseClient } from "@supabase/supabase-js";
import { compterReservations, type ReservationLue, type ReservationsSeance } from "./reservations";

/** Nombre de réservations de chaque séance demandée (E9), regroupé en un seul appel à la base. */
export async function lireReservationsParSeance(
  client: SupabaseClient,
  seanceIds: number[],
  maintenant: Date = new Date(),
): Promise<Map<number, ReservationsSeance>> {
  const resultat = new Map<number, ReservationsSeance>();
  if (seanceIds.length === 0) return resultat;
  const { data, error } = await client
    .from("reservation")
    .select("seance_id, statut, cree_at")
    .in("seance_id", seanceIds)
    .in("statut", ["confirmee", "en_attente_paiement"]);
  if (error) throw new Error(`Lecture des réservations impossible : ${error.message}`);

  const parSeance = new Map<number, ReservationLue[]>();
  for (const ligne of data as { seance_id: number; statut: string; cree_at: string }[]) {
    const liste = parSeance.get(ligne.seance_id) ?? [];
    liste.push({ statut: ligne.statut, creeAt: new Date(ligne.cree_at) });
    parSeance.set(ligne.seance_id, liste);
  }
  for (const id of seanceIds) {
    resultat.set(id, compterReservations(parSeance.get(id) ?? [], maintenant));
  }
  return resultat;
}
