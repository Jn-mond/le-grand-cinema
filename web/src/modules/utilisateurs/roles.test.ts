import { describe, expect, it } from "vitest";
import {
  libelleRole,
  pageApresConnexion,
  peutConsulterReservations,
  peutControlerBillets,
  peutProgrammer,
  type Role,
} from "./roles";

const TOUS: Role[] = ["spectateur", "professionnel", "accueil", "programmateur", "administrateur"];

describe("peutProgrammer", () => {
  it("n'autorise que le programmateur et l'administrateur", () => {
    expect(TOUS.filter(peutProgrammer)).toEqual(["programmateur", "administrateur"]);
  });
});

describe("peutConsulterReservations", () => {
  it("autorise l'accueil et la programmation, pas les clients", () => {
    expect(TOUS.filter(peutConsulterReservations)).toEqual([
      "accueil",
      "programmateur",
      "administrateur",
    ]);
  });
});

describe("peutControlerBillets", () => {
  it("autorise le personnel de l'accueil et de la programmation, pas les clients", () => {
    expect(TOUS.filter(peutControlerBillets)).toEqual([
      "accueil",
      "programmateur",
      "administrateur",
    ]);
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
