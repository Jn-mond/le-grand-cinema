import { describe, expect, it } from "vitest";
import { construireSuivi, libelleCanal, type ReservationBrute } from "./suivi";

const MAINTENANT = new Date("2026-11-15T15:00:00Z");
const ilYA = (minutes: number) => new Date(MAINTENANT.getTime() - minutes * 60_000);

const reservation = (id: string, statut: string, minutes: number): ReservationBrute => ({
  id,
  reference: `LGC-${id}`,
  email: `${id.toLowerCase()}@exemple.fr`,
  nomClient: null,
  canal: "en_ligne",
  statut,
  creeAt: ilYA(minutes),
});

describe("construireSuivi", () => {
  const reservations = [
    reservation("ANCIEN", "confirmee", 300),
    reservation("EXPIRE", "en_attente_paiement", 40),
    reservation("ENCOURS", "en_attente_paiement", 2),
    reservation("ANNULE", "annulee", 1),
  ];
  const verrous = [
    { reservationId: "ENCOURS", libelle: "B10" },
    { reservationId: "ENCOURS", libelle: "B2" },
    { reservationId: "EXPIRE", libelle: "C1" },
  ];
  const billets = [{ reservationId: "ANCIEN", libelle: "A3" }];
  const suivi = construireSuivi(reservations, verrous, billets, MAINTENANT);

  it("place les réservations actives d'abord, les plus récentes en premier", () => {
    expect(suivi.map((r) => r.reference)).toEqual([
      "LGC-ENCOURS",
      "LGC-ANCIEN",
      "LGC-ANNULE",
      "LGC-EXPIRE",
    ]);
  });

  it("affiche « expirée » une réservation en attente dont le délai est dépassé (C4)", () => {
    expect(suivi.find((r) => r.reference === "LGC-EXPIRE")?.statut).toBe("expiree");
  });

  it("rattache les places bloquées ou vendues selon le statut, dans l'ordre du plan", () => {
    expect(suivi.find((r) => r.reference === "LGC-ENCOURS")?.places).toEqual(["B2", "B10"]);
    expect(suivi.find((r) => r.reference === "LGC-ANCIEN")?.places).toEqual(["A3"]);
    expect(suivi.find((r) => r.reference === "LGC-EXPIRE")?.places).toEqual([]);
    expect(suivi.find((r) => r.reference === "LGC-ANNULE")?.places).toEqual([]);
  });

  it("garde une réservation sans place connue", () => {
    const sansPlace = construireSuivi(
      [reservation("X", "confirmee", 5), reservation("Y", "en_attente_paiement", 1)],
      [],
      [],
      MAINTENANT,
    );
    expect(sansPlace).toMatchObject([
      { reference: "LGC-Y", places: [] },
      { reference: "LGC-X", places: [] },
    ]);
  });
});

describe("libelleCanal", () => {
  it("distingue la vente au guichet de la vente en ligne", () => {
    expect(libelleCanal("guichet")).toBe("Guichet");
    expect(libelleCanal("en_ligne")).toBe("En ligne");
  });
});
