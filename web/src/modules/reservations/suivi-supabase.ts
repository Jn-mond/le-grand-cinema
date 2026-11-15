import type { SupabaseClient } from "@supabase/supabase-js";
import { construireSuivi, type PlaceRattachee, type ReservationSuivie } from "./suivi";

interface LigneReservation {
  id: string;
  reference: string;
  email: string;
  nom_client: string | null;
  canal: string;
  statut: string;
  cree_at: string;
}

type LignePlace = { reservation_id: string; place_id: number };

/**
 * E8 — réservations d'une séance avec leurs places. `libellePlace` traduit l'identifiant d'une place
 * en « B3 », à partir du plan de salle déjà lu par la page.
 */
export async function lireSuiviSeance(
  client: SupabaseClient,
  seanceId: number,
  libellePlace: Map<number, string>,
  maintenant: Date = new Date(),
): Promise<ReservationSuivie[]> {
  const [reservations, verrous, billets] = await Promise.all([
    client
      .from("reservation")
      .select("id, reference, email, nom_client, canal, statut, cree_at")
      .eq("seance_id", seanceId)
      .order("cree_at", { ascending: false })
      .limit(500),
    client
      .from("verrou_place")
      .select("reservation_id, place_id")
      .eq("seance_id", seanceId)
      .gt("expire_at", maintenant.toISOString()),
    client
      .from("billet")
      .select("reservation_id, place_id")
      .eq("seance_id", seanceId)
      .in("statut", ["valide", "utilise"]),
  ]);
  if (reservations.error) {
    throw new Error(`Lecture des réservations impossible : ${reservations.error.message}`);
  }
  if (verrous.error) throw new Error(`Lecture des verrous impossible : ${verrous.error.message}`);
  if (billets.error) throw new Error(`Lecture des billets impossible : ${billets.error.message}`);

  const versPlaces = (lignes: LignePlace[]): PlaceRattachee[] =>
    lignes.map((ligne) => ({
      reservationId: ligne.reservation_id,
      libelle: libellePlace.get(ligne.place_id) ?? `place ${ligne.place_id}`,
    }));
  return construireSuivi(
    (reservations.data as LigneReservation[]).map((ligne) => ({
      id: ligne.id,
      reference: ligne.reference,
      email: ligne.email,
      nomClient: ligne.nom_client,
      canal: ligne.canal,
      statut: ligne.statut,
      creeAt: new Date(ligne.cree_at),
    })),
    versPlaces(verrous.data as LignePlace[]),
    versPlaces(billets.data as LignePlace[]),
    maintenant,
  );
}
