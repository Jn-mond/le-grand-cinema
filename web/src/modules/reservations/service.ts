import { ErreurApplication } from "../../lib/erreurs";
import type { DepotReservations, NouvelleReservation, StatutReservation } from "./depot";
import { echeanceReservation, estExpiree, normaliserPlaces } from "./regles";

export interface ReservationCreee {
  id: string;
  reference: string;
  seanceId: number;
  statut: StatutReservation;
  expireAt: Date;
}

export interface PlacesVerrouillees {
  reservationId: string;
  placeIds: number[];
  expireAt: Date;
}

/** E3 — ouvre une réservation sur une séance publiée et à venir. */
export async function creerReservation(
  depot: DepotReservations,
  demande: NouvelleReservation,
): Promise<ReservationCreee> {
  const etat = await depot.etatSeance(demande.seanceId);
  if (etat === "introuvable") {
    throw new ErreurApplication("SEANCE_INTROUVABLE", "Séance introuvable");
  }
  if (etat === "non_reservable") {
    throw new ErreurApplication(
      "SEANCE_NON_RESERVABLE",
      "Cette séance n'est pas ouverte à la réservation",
    );
  }
  const reservation = await depot.creer(demande);
  return {
    id: reservation.id,
    reference: reservation.reference,
    seanceId: reservation.seanceId,
    statut: reservation.statut,
    expireAt: echeanceReservation(reservation.creeAt),
  };
}

/** E3 — bloque les places choisies jusqu'à l'échéance de la réservation (10 minutes). */
export async function verrouillerPlaces(
  depot: DepotReservations,
  reservationId: string,
  placeIds: readonly number[],
  maintenant: Date = new Date(),
): Promise<PlacesVerrouillees> {
  const places = normaliserPlaces(placeIds);

  const reservation = await depot.trouver(reservationId);
  if (!reservation) {
    throw new ErreurApplication("RESERVATION_INTROUVABLE", "Réservation introuvable");
  }
  if (reservation.statut !== "en_attente_paiement") {
    throw new ErreurApplication(
      "RESERVATION_NON_MODIFIABLE",
      "Cette réservation n'accepte plus de choix de places",
      { statut: reservation.statut },
    );
  }
  if (estExpiree(reservation.creeAt, maintenant)) {
    throw new ErreurApplication(
      "RESERVATION_EXPIREE",
      "Le délai de 10 minutes est dépassé : recommencez la réservation",
    );
  }

  const refusees = await depot.poserVerrous(reservationId, places);
  if (refusees.length > 0) {
    throw new ErreurApplication(
      "PLACES_INDISPONIBLES",
      "Certaines places ne sont plus disponibles : aucune place n'a été bloquée",
      { placesRefusees: refusees },
    );
  }

  return { reservationId, placeIds: places, expireAt: echeanceReservation(reservation.creeAt) };
}
