import { describe, expect, it } from "vitest";
import { erreurLevee } from "../test/utilitaires";
import { decalageParisMinutes, formaterDateHeure, formaterPrix, heureParisVersUtc } from "./dates";

describe("decalageParisMinutes", () => {
  it("vaut une heure en hiver et deux heures en été", () => {
    expect(decalageParisMinutes(new Date("2026-11-20T12:00:00Z"))).toBe(60);
    expect(decalageParisMinutes(new Date("2026-07-14T12:00:00Z"))).toBe(120);
  });
});

describe("heureParisVersUtc", () => {
  it("convertit une heure d'hiver", () => {
    expect(heureParisVersUtc("2026-11-20T20:30").toISOString()).toBe("2026-11-20T19:30:00.000Z");
  });

  it("convertit une heure d'été", () => {
    expect(heureParisVersUtc("2026-07-14T21:00").toISOString()).toBe("2026-07-14T19:00:00.000Z");
  });

  it("gère le jour du passage à l'heure d'hiver", () => {
    expect(heureParisVersUtc("2026-10-25T20:00").toISOString()).toBe("2026-10-25T19:00:00.000Z");
  });

  it("refuse un format inattendu ou une date inexistante", () => {
    for (const saisie of ["20/11/2026 20:30", "2026-02-30T20:00", "2026-11-20T25:00", ""]) {
      expect(erreurLevee(() => heureParisVersUtc(saisie))).toMatchObject({
        code: "REQUETE_INVALIDE",
      });
    }
  });
});

describe("formatage", () => {
  it("affiche la date et l'heure de Paris en français", () => {
    expect(formaterDateHeure(new Date("2026-11-20T19:30:00Z"))).toBe(
      "vendredi 20 novembre 2026 à 20:30",
    );
  });

  it("affiche un prix en euros à partir de centimes", () => {
    expect(formaterPrix(1250).replace(/\s/g, " ")).toBe("12,50 €");
  });
});
