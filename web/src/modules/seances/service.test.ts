import { describe, expect, it } from "vitest";
import type { DepotSeances, PlaceDeSeance } from "./depot";
import { obtenirPlanDeSalle } from "./service";

function place(id: number, etat: PlaceDeSeance["etat"]): PlaceDeSeance {
  return { id, rangee: "A", numero: id, accessiblePmr: false, positionX: id, positionY: 1, etat };
}

function depotAvec(places: PlaceDeSeance[] | null): DepotSeances {
  return { listerPlaces: async () => places };
}

describe("obtenirPlanDeSalle", () => {
  it("renvoie les places et le décompte par état", async () => {
    const plan = await obtenirPlanDeSalle(
      depotAvec([place(1, "libre"), place(2, "vendue"), place(3, "libre"), place(4, "verrouillee")]),
      7,
    );
    expect(plan.seanceId).toBe(7);
    expect(plan.places).toHaveLength(4);
    expect(plan.resume).toEqual({ libre: 2, verrouillee: 1, vendue: 1 });
  });

  it("refuse une séance inconnue ou non publiée", async () => {
    await expect(obtenirPlanDeSalle(depotAvec(null), 99)).rejects.toMatchObject({
      code: "SEANCE_INTROUVABLE",
      statut: 404,
    });
  });
});
