import { describe, expect, it } from "vitest";
import { libelleRole, pageApresConnexion, peutProgrammer, type Role } from "./roles";

const TOUS: Role[] = ["spectateur", "professionnel", "accueil", "programmateur", "administrateur"];

describe("peutProgrammer", () => {
  it("n'autorise que le programmateur et l'administrateur", () => {
    expect(TOUS.filter(peutProgrammer)).toEqual(["programmateur", "administrateur"]);
  });
});

describe("pageApresConnexion", () => {
  it("envoie le personnel de programmation vers /admin et les autres vers /espace", () => {
    expect(pageApresConnexion("administrateur")).toBe("/admin");
    expect(pageApresConnexion("programmateur")).toBe("/admin");
    expect(pageApresConnexion("spectateur")).toBe("/espace");
    expect(pageApresConnexion("accueil")).toBe("/espace");
  });
});

describe("libelleRole", () => {
  it("donne un libellé à chaque rôle", () => {
    expect(TOUS.map(libelleRole)).toEqual([
      "Spectateur",
      "Professionnel",
      "Accueil",
      "Programmation",
      "Administration",
    ]);
  });
});
