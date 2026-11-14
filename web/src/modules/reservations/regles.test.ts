import { describe, expect, it } from "vitest";
import { erreurLevee } from "../../test/utilitaires";
import {
  DUREE_VERROU_MINUTES,
  MAX_PLACES_PAR_RESERVATION,
  echeanceReservation,
  estExpiree,
  normaliserPlaces,
  resultatAOublier,
  statutAffiche,
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

describe("statutAffiche", () => {
  it("affiche « expirée » une réservation non payée dont le délai est dépassé", () => {
    const avant = new Date("2026-11-20T18:09:59.000Z");
    const apres = new Date("2026-11-20T18:10:00.000Z");
    expect(statutAffiche("en_attente_paiement", CREATION, avant)).toBe("en_attente_paiement");
    expect(statutAffiche("en_attente_paiement", CREATION, apres)).toBe("expiree");
  });

  it("ne touche pas aux autres statuts", () => {
    const tard = new Date("2026-12-01T00:00:00.000Z");
    expect(statutAffiche("confirmee", CREATION, tard)).toBe("confirmee");
    expect(statutAffiche("annulee", CREATION, tard)).toBe("annulee");
  });
});

describe("resultatAOublier", () => {
  const maintenant = new Date("2026-11-20T18:05:00.000Z");
  const bloquee = (expireAt: string) => ({ statut: "bloquee", expireAt });

  it("garde des places encore bloquées", () => {
    expect(resultatAOublier(bloquee("2026-11-20T18:10:00.000Z"), maintenant)).toBe(false);
  });

  it("oublie des places dont le délai est dépassé (correctif C3)", () => {
    expect(resultatAOublier(bloquee("2026-11-20T18:05:00.000Z"), maintenant)).toBe(true);
    expect(resultatAOublier(bloquee("2026-11-20T18:00:00.000Z"), maintenant)).toBe(true);
  });

  it("oublie un refus ou une erreur, pas un formulaire en cours", () => {
    expect(resultatAOublier({ statut: "refus" }, maintenant)).toBe(true);
    expect(resultatAOublier({ statut: "erreur" }, maintenant)).toBe(true);
    expect(resultatAOublier({ statut: "initial" }, maintenant)).toBe(false);
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
