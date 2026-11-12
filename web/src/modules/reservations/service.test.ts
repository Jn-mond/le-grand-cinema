import { beforeEach, describe, expect, it } from "vitest";
import type {
  DepotReservations,
  EtatSeance,
  NouvelleReservation,
  ReservationEnregistree,
} from "./depot";
import { creerReservation, verrouillerPlaces } from "./service";

const CREATION = new Date("2026-11-20T18:00:00.000Z");
const AVANT_ECHEANCE = new Date("2026-11-20T18:05:00.000Z");
const APRES_ECHEANCE = new Date("2026-11-20T18:10:01.000Z");
const ID_RESERVATION = "3f2b6c1e-8a4d-4f6b-9c2e-1a2b3c4d5e6f";

/** Dépôt en mémoire : simule la base sans connexion réseau. */
class DepotEnMemoire implements DepotReservations {
  etat: EtatSeance = "reservable";
  reservations = new Map<string, ReservationEnregistree>();
  placesPrises = new Set<number>();
  verrous = new Map<number, string>();
  creees: NouvelleReservation[] = [];

  async etatSeance(): Promise<EtatSeance> {
    return this.etat;
  }

  async creer(reservation: NouvelleReservation): Promise<ReservationEnregistree> {
    this.creees.push(reservation);
    const enregistree: ReservationEnregistree = {
      id: ID_RESERVATION,
      reference: "LGC-7K4Q2M",
      seanceId: reservation.seanceId,
      statut: "en_attente_paiement",
      creeAt: CREATION,
    };
    this.reservations.set(enregistree.id, enregistree);
    return enregistree;
  }

  async trouver(reservationId: string): Promise<ReservationEnregistree | null> {
    return this.reservations.get(reservationId) ?? null;
  }

  async poserVerrous(reservationId: string, placeIds: number[]): Promise<number[]> {
    const refusees = placeIds.filter((id) => this.placesPrises.has(id));
    if (refusees.length === 0) {
      placeIds.forEach((id) => this.verrous.set(id, reservationId));
    }
    return refusees;
  }
}

let depot: DepotEnMemoire;

beforeEach(() => {
  depot = new DepotEnMemoire();
});

describe("creerReservation", () => {
  it("crée la réservation et annonce l'échéance à 10 minutes", async () => {
    const reservation = await creerReservation(depot, { seanceId: 1, email: "a@exemple.test" });
    expect(reservation).toEqual({
      id: ID_RESERVATION,
      reference: "LGC-7K4Q2M",
      seanceId: 1,
      statut: "en_attente_paiement",
      expireAt: new Date("2026-11-20T18:10:00.000Z"),
    });
  });

  it("refuse une séance inconnue sans rien créer", async () => {
    depot.etat = "introuvable";
    await expect(
      creerReservation(depot, { seanceId: 99, email: "a@exemple.test" }),
    ).rejects.toMatchObject({ code: "SEANCE_INTROUVABLE", statut: 404 });
    expect(depot.creees).toHaveLength(0);
  });

  it("refuse une séance non publiée ou déjà commencée", async () => {
    depot.etat = "non_reservable";
    await expect(
      creerReservation(depot, { seanceId: 1, email: "a@exemple.test" }),
    ).rejects.toMatchObject({ code: "SEANCE_NON_RESERVABLE", statut: 422 });
  });
});

describe("verrouillerPlaces", () => {
  beforeEach(async () => {
    await creerReservation(depot, { seanceId: 1, email: "a@exemple.test" });
  });

  it("bloque les places choisies, sans doublon et dans l'ordre", async () => {
    const resultat = await verrouillerPlaces(depot, ID_RESERVATION, [14, 12, 12], AVANT_ECHEANCE);
    expect(resultat).toEqual({
      reservationId: ID_RESERVATION,
      placeIds: [12, 14],
      expireAt: new Date("2026-11-20T18:10:00.000Z"),
    });
    expect([...depot.verrous.keys()]).toEqual([12, 14]);
  });

  it("signale les places déjà prises et n'en bloque aucune", async () => {
    depot.placesPrises.add(13);
    await expect(
      verrouillerPlaces(depot, ID_RESERVATION, [12, 13], AVANT_ECHEANCE),
    ).rejects.toMatchObject({
      code: "PLACES_INDISPONIBLES",
      statut: 409,
      details: { placesRefusees: [13] },
    });
    expect(depot.verrous.size).toBe(0);
  });

  it("refuse une réservation inconnue", async () => {
    await expect(
      verrouillerPlaces(depot, "00000000-0000-4000-8000-000000000000", [1], AVANT_ECHEANCE),
    ).rejects.toMatchObject({ code: "RESERVATION_INTROUVABLE", statut: 404 });
  });

  it("refuse une réservation de plus de 10 minutes (correctif C1)", async () => {
    await expect(
      verrouillerPlaces(depot, ID_RESERVATION, [1], APRES_ECHEANCE),
    ).rejects.toMatchObject({ code: "RESERVATION_EXPIREE", statut: 410 });
    expect(depot.verrous.size).toBe(0);
  });

  it("refuse une réservation déjà confirmée", async () => {
    const reservation = depot.reservations.get(ID_RESERVATION);
    if (reservation) reservation.statut = "confirmee";
    await expect(
      verrouillerPlaces(depot, ID_RESERVATION, [1], AVANT_ECHEANCE),
    ).rejects.toMatchObject({ code: "RESERVATION_NON_MODIFIABLE", statut: 409 });
  });

  it("vérifie la sélection avant d'interroger la base", async () => {
    await expect(verrouillerPlaces(depot, ID_RESERVATION, [], AVANT_ECHEANCE)).rejects.toMatchObject({
      code: "REQUETE_INVALIDE",
    });
    expect(depot.verrous.size).toBe(0);
  });
});
