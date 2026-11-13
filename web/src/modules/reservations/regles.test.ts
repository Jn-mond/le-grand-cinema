import { describe, expect, it } from "vitest";
import { erreurLevee } from "../../test/utilitaires";
import {
  DUREE_VERROU_MINUTES,
  MAX_PLACES_PAR_RESERVATION,
  echeanceReservation,
  estExpiree,
  normaliserPlaces,
} from "./regles";

const CREATION = new Date("2026-11-20T18:00:00.000Z");

describe("echeanceReservation", () => {
  it("fixe l'échéance 10 minutes après la création de la réservation", () => {
    expect(DUREE_VERROU_MINUTES).toBe(10);
    expect(echeanceReservation(CREATION).toISOString()).toBe("2026-11-20T18:10:00.000Z");
  });
});

describe("estExpiree", () => {
  it("n'est pas expirée une seconde avant l'échéance", () => {
    expect(estExpiree(CREATION, new Date("2026-11-20T18:09:59.000Z"))).toBe(false);
  });

  it("est expirée à l'échéance exacte (même règle que la base : <= now())", () => {
    expect(estExpiree(CREATION, new Date("2026-11-20T18:10:00.000Z"))).toBe(true);
  });
});

describe("normaliserPlaces", () => {
  it("supprime les doublons et trie les places", () => {
    expect(normaliserPlaces([14, 12, 14, 13])).toEqual([12, 13, 14]);
  });

  it("refuse une sélection vide", () => {
    expect(erreurLevee(() => normaliserPlaces([]))).toMatchObject({ code: "REQUETE_INVALIDE" });
  });

  it("accepte le maximum autorisé", () => {
    const places = Array.from({ length: MAX_PLACES_PAR_RESERVATION }, (_, i) => i + 1);
    expect(normaliserPlaces(places)).toHaveLength(MAX_PLACES_PAR_RESERVATION);
  });

  it("refuse une place de plus que le maximum", () => {
    const places = Array.from({ length: MAX_PLACES_PAR_RESERVATION + 1 }, (_, i) => i + 1);
    expect(erreurLevee(() => normaliserPlaces(places))).toMatchObject({
      code: "PLACES_TROP_NOMBREUSES",
    });
  });
});
