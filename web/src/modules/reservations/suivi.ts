import { statutAffiche } from "./regles";

/** E8 — une réservation d'une séance, telle que le personnel la consulte. */
export interface ReservationSuivie {
  reference: string;
  email: string;
  nomClient: string | null;
  canal: string;
  /** Statut tel qu'affiché : « expiree » dès que le délai de paiement est dépassé (C4). */
  statut: string;
  creeAt: Date;
  /** Places de la réservation : bloquées si elle est en cours, vendues si elle est confirmée. */
  places: string[];
}

export interface ReservationBrute {
  id: string;
  reference: string;
  email: string;
  nomClient: string | null;
  canal: string;
  statut: string;
  creeAt: Date;
}

/** Une place rattachée à une réservation : verrou non expiré ou billet valide. */
export interface PlaceRattachee {
  reservationId: string;
  libelle: string;
}

const ACTIVES = new Set(["confirmee", "en_attente_paiement"]);

/**
 * Assemble les réservations d'une séance avec leurs places. Les réservations actives (confirmées
 * ou en cours de paiement) viennent d'abord, puis les autres ; les plus récentes en premier.
 */
export function construireSuivi(
  reservations: ReservationBrute[],
  verrous: PlaceRattachee[],
  billets: PlaceRattachee[],
  maintenant: Date = new Date(),
): ReservationSuivie[] {
  const placesPar = (liste: PlaceRattachee[]) => {
    const parReservation = new Map<string, string[]>();
    for (const { reservationId, libelle } of liste) {
      parReservation.set(reservationId, [...(parReservation.get(reservationId) ?? []), libelle]);
    }
    return parReservation;
  };
  const bloquees = placesPar(verrous);
  const vendues = placesPar(billets);

  const suivi = reservations.map((reservation) => {
    const statut = statutAffiche(reservation.statut, reservation.creeAt, maintenant);
    let places: string[] = [];
    if (statut === "confirmee") places = vendues.get(reservation.id) ?? [];
    else if (statut === "en_attente_paiement") places = bloquees.get(reservation.id) ?? [];
    return {
      reference: reservation.reference,
      email: reservation.email,
      nomClient: reservation.nomClient,
      canal: reservation.canal,
      statut,
      creeAt: reservation.creeAt,
      places: [...places].sort((a, b) => a.localeCompare(b, "fr", { numeric: true })),
    };
  });
  return suivi.sort(
    (a, b) =>
      Number(ACTIVES.has(b.statut)) - Number(ACTIVES.has(a.statut)) ||
      b.creeAt.getTime() - a.creeAt.getTime(),
  );
}

export function libelleCanal(canal: string): string {
  return canal === "guichet" ? "Guichet" : "En ligne";
}
