import { beforeEach, describe, expect, it } from "vitest";
import { erreurLevee } from "../../test/utilitaires";
import { valider } from "../reservations/schemas";
import {
  finDeSeance,
  programmerSeance,
  schemaProgrammation,
  type DepotProgrammation,
  type NouvelleSeance,
} from "./programmation";

const MAINTENANT = new Date("2026-11-14T10:00:00Z");

class DepotEnMemoire implements DepotProgrammation {
  films = new Map<number, number>([[1, 120]]);
  salles = new Set<number>([1]);
  creees: NouvelleSeance[] = [];
  occupe = false;

  async dureeFilm(filmId: number): Promise<number | null> {
    return this.films.get(filmId) ?? null;
  }

  async salleExiste(salleId: number): Promise<boolean> {
    return this.salles.has(salleId);
  }

  async creer(seance: NouvelleSeance): Promise<{ id: number } | "chevauchement"> {
    if (this.occupe) return "chevauchement";
    this.creees.push(seance);
    return { id: 42 };
  }
}

let depot: DepotEnMemoire;
beforeEach(() => {
  depot = new DepotEnMemoire();
});

function saisie(valeurs: Record<string, string>) {
  return valider(schemaProgrammation, {
    filmId: "1",
    salleId: "1",
    debut: "2026-11-20T20:30",
    version: "vf",
    prix: "12,50",
    publier: "on",
    ...valeurs,
  });
}

describe("schemaProgrammation", () => {
  it("convertit les champs du formulaire (identifiants, prix en centimes)", () => {
    expect(saisie({})).toEqual({
      filmId: 1,
      salleId: 1,
      debut: "2026-11-20T20:30",
      version: "vf",
      prix: 1250,
      publier: "on",
    });
    expect(saisie({ prix: "9.5" }).prix).toBe(950);
  });

  it("refuse un prix ou une version invalides", () => {
    const invalides: Record<string, string>[] = [
      { prix: "-3" },
      { prix: "12,505" },
      { version: "3d" },
    ];
    for (const valeurs of invalides) {
      expect(erreurLevee(() => saisie(valeurs))).toMatchObject({ code: "REQUETE_INVALIDE" });
    }
  });
});

describe("finDeSeance", () => {
  it("ajoute la durée du film et 15 minutes de nettoyage", () => {
    expect(finDeSeance(new Date("2026-11-20T19:30:00Z"), 120).toISOString()).toBe(
      "2026-11-20T21:45:00.000Z",
    );
  });
});

describe("programmerSeance", () => {
  it("crée une séance publiée à l'heure de Paris, avec sa fin calculée", async () => {
    const seance = await programmerSeance(depot, saisie({}), MAINTENANT);
    expect(seance).toMatchObject({ id: 42, prixCentimes: 1250, statut: "publiee" });
    expect(seance.debutAt.toISOString()).toBe("2026-11-20T19:30:00.000Z");
    expect(seance.finAt.toISOString()).toBe("2026-11-20T21:45:00.000Z");
  });

  it("crée un brouillon si la case « publier » n'est pas cochée", async () => {
    const seance = await programmerSeance(depot, { ...saisie({}), publier: undefined }, MAINTENANT);
    expect(seance.statut).toBe("brouillon");
  });

  it("refuse une séance dans le passé", async () => {
    await expect(
      programmerSeance(depot, saisie({ debut: "2026-11-01T20:00" }), MAINTENANT),
    ).rejects.toMatchObject({ code: "SEANCE_DANS_LE_PASSE", statut: 422 });
    expect(depot.creees).toHaveLength(0);
  });

  it("refuse un film ou une salle inconnus", async () => {
    await expect(
      programmerSeance(depot, saisie({ filmId: "99" }), MAINTENANT),
    ).rejects.toMatchObject({ code: "FILM_INTROUVABLE" });
    await expect(
      programmerSeance(depot, saisie({ salleId: "99" }), MAINTENANT),
    ).rejects.toMatchObject({ code: "SALLE_INTROUVABLE" });
  });

  it("signale un chevauchement avec une autre séance de la salle", async () => {
    depot.occupe = true;
    await expect(programmerSeance(depot, saisie({}), MAINTENANT)).rejects.toMatchObject({
      code: "SEANCE_EN_CONFLIT",
      statut: 409,
    });
  });
});
