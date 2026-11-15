import { describe, expect, it } from "vitest";
import { calculerRemplissage, detailRemplissage, libelleTaux } from "./remplissage";

describe("calculerRemplissage", () => {
  it("rapporte les places vendues aux places offertes, arrondi au dixième", () => {
    // Même cas que le test T28 de la base : 1 place vendue sur 24 = 4,17 %, affiché 4,2 %.
    const remplissage = calculerRemplissage(24, 1, 2);
    expect(remplissage).toEqual({
      placesOffertes: 24,
      placesVendues: 1,
      placesBloquees: 2,
      placesLibres: 21,
      tauxPct: 4.2,
      complet: false,
    });
    expect(libelleTaux(remplissage)).toBe("4,2 %");
  });

  it("ne compte pas les places en cours de réservation dans le taux", () => {
    expect(calculerRemplissage(24, 0, 5).tauxPct).toBe(0);
  });

  it("signale une séance complète", () => {
    const remplissage = calculerRemplissage(24, 24, 0);
    expect(remplissage).toMatchObject({ tauxPct: 100, complet: true, placesLibres: 0 });
    expect(detailRemplissage(remplissage)).toBe("24 vendues sur 24 · complet");
  });

  it("n'invente pas de taux pour une salle sans place active", () => {
    const remplissage = calculerRemplissage(0, 0, 0);
    expect(remplissage).toMatchObject({ tauxPct: null, complet: false, placesLibres: 0 });
    expect(libelleTaux(remplissage)).toBe("—");
  });
});

describe("detailRemplissage", () => {
  it("accorde le pluriel et mentionne les places en cours de réservation", () => {
    expect(detailRemplissage(calculerRemplissage(24, 0, 0))).toBe("0 vendue sur 24");
    expect(detailRemplissage(calculerRemplissage(24, 1, 0))).toBe("1 vendue sur 24");
    expect(detailRemplissage(calculerRemplissage(24, 3, 2))).toBe(
      "3 vendues sur 24 · 2 en cours de réservation",
    );
  });
});
