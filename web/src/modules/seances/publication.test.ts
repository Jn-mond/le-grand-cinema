import { beforeEach, describe, expect, it } from "vitest";
import { erreurLevee } from "../../test/utilitaires";
import { valider } from "../reservations/schemas";
import {
  changerPublication,
  schemaPublication,
  type DepotPublication,
  type EtatSeance,
  type StatutSeance,
} from "./publication";

const MAINTENANT = new Date("2026-11-15T10:00:00Z");
const DEMAIN = new Date("2026-11-16T19:30:00Z");

class DepotEnMemoire implements DepotPublication {
  seances = new Map<number, EtatSeance>([
    [1, { statut: "brouillon", debutAt: DEMAIN }],
    [2, { statut: "publiee", debutAt: DEMAIN }],
  ]);
  occupees = 0;
  /** Simule une modification par une autre personne entre la lecture et l'écriture. */
  concurrence = false;
  changements: [number, StatutSeance, StatutSeance][] = [];

  async lireSeance(seanceId: number): Promise<EtatSeance | null> {
    return this.seances.get(seanceId) ?? null;
  }

  async placesOccupees(): Promise<number> {
    return this.occupees;
  }

  async changerStatut(seanceId: number, de: StatutSeance, vers: StatutSeance): Promise<boolean> {
    if (this.concurrence) return false;
    this.changements.push([seanceId, de, vers]);
    return true;
  }
}

let depot: DepotEnMemoire;
beforeEach(() => {
  depot = new DepotEnMemoire();
});

const demande = (seanceId: number, action: "publier" | "retirer") =>
  valider(schemaPublication, { seanceId: String(seanceId), action });

describe("schemaPublication", () => {
  it("lit les champs du formulaire et refuse une action inconnue", () => {
    expect(demande(2, "retirer")).toEqual({ seanceId: 2, action: "retirer" });
    expect(
      erreurLevee(() => valider(schemaPublication, { seanceId: "2", action: "supprimer" })),
    ).toMatchObject({ code: "REQUETE_INVALIDE" });
  });
});

describe("changerPublication", () => {
  it("publie une séance en brouillon", async () => {
    const resultat = await changerPublication(depot, demande(1, "publier"), MAINTENANT);
    expect(resultat).toEqual({ seanceId: 1, statut: "publiee", modifiee: true });
    expect(depot.changements).toEqual([[1, "brouillon", "publiee"]]);
  });

  it("retire une séance publiée sans place occupée", async () => {
    const resultat = await changerPublication(depot, demande(2, "retirer"), MAINTENANT);
    expect(resultat).toEqual({ seanceId: 2, statut: "brouillon", modifiee: true });
    expect(depot.changements).toEqual([[2, "publiee", "brouillon"]]);
  });

  it("ne change rien si la séance a déjà le statut demandé (double clic)", async () => {
    const resultat = await changerPublication(depot, demande(2, "publier"), MAINTENANT);
    expect(resultat).toEqual({ seanceId: 2, statut: "publiee", modifiee: false });
    expect(depot.changements).toHaveLength(0);
  });

  it("refuse de retirer une séance dont des places sont vendues ou bloquées", async () => {
    depot.occupees = 3;
    await expect(
      changerPublication(depot, demande(2, "retirer"), MAINTENANT),
    ).rejects.toMatchObject({
      code: "SEANCE_AVEC_RESERVATIONS",
    });
    expect(depot.changements).toHaveLength(0);
  });

  it("refuse une séance introuvable, commencée ou annulée", async () => {
    await expect(
      changerPublication(depot, demande(9, "publier"), MAINTENANT),
    ).rejects.toMatchObject({
      code: "SEANCE_INTROUVABLE",
    });
    depot.seances.set(3, { statut: "brouillon", debutAt: MAINTENANT });
    await expect(
      changerPublication(depot, demande(3, "publier"), MAINTENANT),
    ).rejects.toMatchObject({
      code: "SEANCE_NON_MODIFIABLE",
    });
    depot.seances.set(4, { statut: "annulee", debutAt: DEMAIN });
    await expect(
      changerPublication(depot, demande(4, "publier"), MAINTENANT),
    ).rejects.toMatchObject({
      code: "SEANCE_NON_MODIFIABLE",
    });
  });

  it("signale une modification faite entre-temps par une autre personne", async () => {
    depot.concurrence = true;
    await expect(
      changerPublication(depot, demande(1, "publier"), MAINTENANT),
    ).rejects.toMatchObject({
      code: "SEANCE_NON_MODIFIABLE",
    });
  });
});
