/** Accès aux données des réservations. Le service ne dépend que de ce contrat, ce qui
 * permet de le tester sans base de données. */

export type StatutReservation = "en_attente_paiement" | "confirmee" | "annulee" | "expiree";

export type EtatSeance = "reservable" | "non_reservable" | "introuvable";

export interface ReservationEnregistree {
  id: string;
  reference: string;
  seanceId: number;
  statut: StatutReservation;
  creeAt: Date;
}

export interface NouvelleReservation {
  seanceId: number;
  email: string;
  nomClient?: string;
}

export interface DepotReservations {
  etatSeance(seanceId: number): Promise<EtatSeance>;
  creer(reservation: NouvelleReservation): Promise<ReservationEnregistree>;
  trouver(reservationId: string): Promise<ReservationEnregistree | null>;
  /** Verrouille toutes les places ou aucune ; retourne les places refusées (vide si succès). */
  poserVerrous(reservationId: string, placeIds: number[]): Promise<number[]>;
}
