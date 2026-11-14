import { describe, expect, it } from "vitest";
import type { PlaceDeSeance } from "./depot";
import {
  descriptionPlace,
  libellePlace,
  libelleStatut,
  organiserPlan,
  reservationEnLigneOuverte,
} from "./plan";

function place(id: number, rangee: string, numero: number, etat: PlaceDeSeance["etat"] = "libre") {
  return { id, rangee, numero, accessiblePmr: false, positionX: numero, positionY: 1, etat };
}

describe("organiserPlan", () => {
  it("regroupe par rangée dans l'ordre alphabétique et trie les places par numéro", () => {
    const plan = organiserPlan([
      place(1, "B", 2),
      place(2, "A", 2),
      place(3, "A", 1),
      place(4, "B", 1),
    ]);
    expect(plan.map((r) => r.rangee)).toEqual(["A", "B"]);
    expect(plan[0].places.map(libellePlace)).toEqual(["A1", "A2"]);
    expect(plan[1].places.map(libellePlace)).toEqual(["B1", "B2"]);
  });

  it("place les rangées à deux lettres après celles à une lettre (Z avant AA)", () => {
    const plan = organiserPlan([place(1, "AA", 1), place(2, "Z", 1), place(3, "B", 1)]);
    expect(plan.map((r) => r.rangee)).toEqual(["B", "Z", "AA"]);
  });

  it("renvoie un plan vide sans place", () => {
    expect(organiserPlan([])).toEqual([]);
  });
});

describe("descriptionPlace", () => {
  it("décrit la place pour les lecteurs d'écran, avec l'accessibilité PMR", () => {
    expect(descriptionPlace(place(1, "A", 3, "vendue"))).toBe("Rangée A, place 3, vendue");
    expect(descriptionPlace({ ...place(1, "A", 1, "verrouillee"), accessiblePmr: true })).toBe(
      "Rangée A, place 1, en cours de réservation, accessible PMR",
    );
  });
});

describe("libelleStatut", () => {
  it("traduit les statuts stockés en base et laisse passer un statut inconnu", () => {
    expect(libelleStatut("publiee")).toBe("Publiée");
    expect(libelleStatut("en_attente_paiement")).toBe("En attente de paiement");
    expect(libelleStatut("inconnu")).toBe("inconnu");
  });
});

describe("reservationEnLigneOuverte", () => {
  const debut = new Date("2026-11-20T19:30:00Z");

  it("reste ouverte jusqu'au début de la séance, puis ferme", () => {
    expect(reservationEnLigneOuverte(debut, new Date("2026-11-20T19:29:59Z"))).toBe(true);
    expect(reservationEnLigneOuverte(debut, debut)).toBe(false);
    expect(reservationEnLigneOuverte(debut, new Date("2026-11-20T21:00:00Z"))).toBe(false);
  });
});
