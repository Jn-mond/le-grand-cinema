import { describe, expect, it } from "vitest";
import { erreurLevee } from "../../test/utilitaires";
import { valider } from "../reservations/schemas";
import {
  afficheSure,
  formaterDateSortie,
  formaterDuree,
  libelleAge,
  schemaIdentifiantFilm,
} from "./fiche";

describe("formaterDuree", () => {
  it("écrit une durée en heures et minutes", () => {
    expect(formaterDuree(120)).toBe("2 h");
    expect(formaterDuree(95)).toBe("1 h 35");
    expect(formaterDuree(125)).toBe("2 h 05");
    expect(formaterDuree(45)).toBe("45 min");
  });
});

describe("libelleAge", () => {
  it("traduit l'âge minimum en mention lisible", () => {
    expect(libelleAge(0)).toBe("Tous publics");
    expect(libelleAge(12)).toBe("Interdit aux moins de 12 ans");
  });
});

describe("afficheSure", () => {
  it("n'accepte qu'une adresse https bien formée", () => {
    expect(afficheSure("https://images.exemple.fr/affiche.jpg")).toBe(
      "https://images.exemple.fr/affiche.jpg",
    );
    expect(afficheSure("http://images.exemple.fr/affiche.jpg")).toBe(null);
    expect(afficheSure("javascript:alert(1)")).toBe(null);
    expect(afficheSure("pas une adresse")).toBe(null);
    expect(afficheSure(null)).toBe(null);
  });
});

describe("formaterDateSortie", () => {
  it("affiche une date de sortie sans décalage de fuseau", () => {
    expect(formaterDateSortie("2026-10-16")).toBe("16 octobre 2026");
    expect(formaterDateSortie("2026-01-01")).toBe("1 janvier 2026");
  });

  it("ignore une date absente ou mal formée", () => {
    expect(formaterDateSortie(null)).toBe(null);
    expect(formaterDateSortie("16/10/2026")).toBe(null);
  });
});

describe("schemaIdentifiantFilm", () => {
  it("accepte un entier positif tiré de l'adresse et refuse le reste", () => {
    expect(valider(schemaIdentifiantFilm, "3")).toBe(3);
    for (const valeur of ["0", "-1", "abc", "2.5"]) {
      expect(erreurLevee(() => valider(schemaIdentifiantFilm, valeur))).toMatchObject({
        code: "REQUETE_INVALIDE",
      });
    }
  });
});
