import { describe, expect, it } from "vitest";
import { etatPaiement, type SituationPaiement } from "./suivi";

const MAINTENANT = new Date("2026-11-20T18:00:00Z");
const DANS_5_MIN = new Date("2026-11-20T18:05:00Z");
const IL_Y_A_1_MIN = new Date("2026-11-20T17:59:00Z");

const situation = (modification: Partial<SituationPaiement>): SituationPaiement => ({
  statutReservation: "en_attente_paiement",
  derniereCommande: null,
  bloqueeJusqua: DANS_5_MIN,
  retour: undefined,
  ...modification,
});

describe("etatPaiement", () => {
  it.each([
    [{ statutReservation: "confirmee", derniereCommande: "payee" }, "confirmee"],
    [{ derniereCommande: "en_attente", retour: "succes" }, "en_cours"],
    [{ derniereCommande: "en_attente", retour: "succes", bloqueeJusqua: null }, "en_cours"],
    [{ statutReservation: "expiree", derniereCommande: "echouee" }, "non_abouti"],
    [{ derniereCommande: "echouee" }, "non_abouti"],
    [{ derniereCommande: "en_attente", retour: "abandon" }, "abandon"],
    [{ derniereCommande: "abandonnee" }, "abandon"],
    [{}, "a_payer"],
    [{ derniereCommande: "en_attente" }, "a_payer"],
    [{ bloqueeJusqua: IL_Y_A_1_MIN }, "expiree"],
    [{ bloqueeJusqua: null, retour: "abandon" }, "expiree"],
    [{ statutReservation: "expiree" }, "expiree"],
    [{ statutReservation: "annulee", derniereCommande: "abandonnee" }, "expiree"],
  ])("%o → %s", (modification: Partial<SituationPaiement>, attendu: string) => {
    expect(etatPaiement(situation(modification), MAINTENANT)).toBe(attendu);
  });

  it("utilise l'heure courante par défaut", () => {
    expect(etatPaiement(situation({ bloqueeJusqua: new Date(Date.now() + 60_000) }))).toBe(
      "a_payer",
    );
  });
});
