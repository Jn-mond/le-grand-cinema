import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  DepotReservations,
  EtatSeance,
  NouvelleReservation,
  ReservationEnregistree,
  StatutReservation,
} from "./depot";

interface LigneReservation {
  id: string;
  reference: string;
  seance_id: number;
  statut: StatutReservation;
  cree_at: string;
}

const COLONNES_RESERVATION = "id, reference, seance_id, statut, cree_at";

function versReservation(ligne: LigneReservation): ReservationEnregistree {
  return {
    id: ligne.id,
    reference: ligne.reference,
    seanceId: ligne.seance_id,
    statut: ligne.statut,
    creeAt: new Date(ligne.cree_at),
  };
}

/** Implémentation du dépôt avec Supabase (tables et fonctions de db/migrations). */
export class DepotReservationsSupabase implements DepotReservations {
  constructor(private readonly client: SupabaseClient) {}

  async etatSeance(seanceId: number): Promise<EtatSeance> {
    const { data, error } = await this.client
      .from("seance")
      .select("statut, debut_at")
      .eq("id", seanceId)
      .maybeSingle();
    if (error) throw new Error(`Lecture de la séance impossible : ${error.message}`);
    if (!data) return "introuvable";
    const seance = data as { statut: string; debut_at: string };
    const aVenir = new Date(seance.debut_at).getTime() > Date.now();
    return seance.statut === "publiee" && aVenir ? "reservable" : "non_reservable";
  }

  async creer(reservation: NouvelleReservation): Promise<ReservationEnregistree> {
    const { data, error } = await this.client
      .from("reservation")
      .insert({
        seance_id: reservation.seanceId,
        email: reservation.email,
        nom_client: reservation.nomClient ?? null,
      })
      .select(COLONNES_RESERVATION)
      .single();
    if (error) throw new Error(`Création de la réservation impossible : ${error.message}`);
    return versReservation(data as LigneReservation);
  }

  async trouver(reservationId: string): Promise<ReservationEnregistree | null> {
    const { data, error } = await this.client
      .from("reservation")
      .select(COLONNES_RESERVATION)
      .eq("id", reservationId)
      .maybeSingle();
    if (error) throw new Error(`Lecture de la réservation impossible : ${error.message}`);
    return data ? versReservation(data as LigneReservation) : null;
  }

  async poserVerrous(reservationId: string, placeIds: number[]): Promise<number[]> {
    const { data, error } = await this.client.rpc("poser_verrous", {
      p_reservation: reservationId,
      p_places: placeIds,
    });
    if (error) throw new Error(`Verrouillage impossible : ${error.message}`);
    return Array.isArray(data) ? data.map(Number) : [];
  }
}
