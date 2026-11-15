import { describe, expect, it } from "vitest";
import { compterReservations, libelleReservations } from "./reservations";

const MAINTENANT = new Date("2026-11-15T15:00:00Z");
const ilYA = (minutes: number) => new Date(MAINTENANT.getTime() - minutes * 60_000);

describe("compterReservations", () => {
  it("compte les réservations confirmées et celles encore dans le délai de paiement", () => {
    const reservations = [
      { statut: "confirmee", creeAt: ilYA(120) },
      { statut: "confirmee", creeAt: ilYA(30) },
      { statut: "en_attente_paiement", creeAt: ilYA(3) },
    ];
    expect(compterReservations(reservations, MAINTENANT)).toEqual({ confirmees: 2, enCours: 1 });
  });

  it("ne compte ni une réservation en attente dont le délai est dépassé, ni une annulée", () => {
    const reservations = [
      { statut: "en_attente_paiement", creeAt: ilYA(10) },
      { statut: "en_attente_paiement", creeAt: ilYA(45) },
      { statut: "annulee", creeAt: ilYA(5) },
      { statut: "expiree", creeAt: ilYA(60) },
    ];
    expect(compterReservations(reservations, MAINTENANT)).toEqual({ confirmees: 0, enCours: 0 });
  });
});

describe("libelleReservations", () => {
  it("résume les réservations avec les bons accords", () => {
    expect(libelleReservations({ confirmees: 0, enCours: 0 })).toBe("Aucune");
    expect(libelleReservations({ confirmees: 1, enCours: 0 })).toBe("1 confirmée");
    expect(libelleReservations({ confirmees: 0, enCours: 2 })).toBe("0 confirmée · 2 en cours");
    expect(libelleReservations({ confirmees: 3, enCours: 1 })).toBe("3 confirmées · 1 en cours");
  });
});
