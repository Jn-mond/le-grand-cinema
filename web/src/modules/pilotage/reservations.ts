import { statutAffiche } from "../reservations/regles";

/** E9 — réservations d'une séance, telles que le personnel doit les compter. */
export interface ReservationsSeance {
  /** Payées. */
  confirmees: number;
  /** En attente de paiement, délai de 10 minutes non dépassé. */
  enCours: number;
}

export interface ReservationLue {
  statut: string;
  creeAt: Date;
}

/**
 * Compte les réservations confirmées et celles en cours de paiement. Une réservation « en attente »
 * dont le délai est dépassé est expirée, même si la base ne l'a pas encore notée (correctif C4) :
 * elle n'est pas comptée, comme les réservations annulées.
 */
export function compterReservations(
  reservations: ReservationLue[],
  maintenant: Date = new Date(),
): ReservationsSeance {
  let confirmees = 0;
  let enCours = 0;
  for (const reservation of reservations) {
    const statut = statutAffiche(reservation.statut, reservation.creeAt, maintenant);
    if (statut === "confirmee") confirmees += 1;
    else if (statut === "en_attente_paiement") enCours += 1;
  }
  return { confirmees, enCours };
}

/** « 2 confirmées · 1 en cours », ou « Aucune » quand la séance n'a encore aucune réservation. */
export function libelleReservations({ confirmees, enCours }: ReservationsSeance): string {
  if (confirmees === 0 && enCours === 0) return "Aucune";
  const parties = [`${confirmees} confirmée${confirmees > 1 ? "s" : ""}`];
  if (enCours > 0) parties.push(`${enCours} en cours`);
  return parties.join(" · ");
}
