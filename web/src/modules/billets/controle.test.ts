import { describe, expect, it } from "vitest";
import { controlerBillet, lireJeton, verdict, type Controle, type DepotControle } from "./controle";

const JETON = "3f2b8c1e-9a4d-4e6f-8b7a-1c2d3e4f5a6b";
const SEANCE = new Date("2026-11-20T19:30:00Z");

const controle = (modification: Partial<Controle>): Controle => ({
  resultat: "accepte",
  film: "Meilleure Vie",
  debutSeance: SEANCE,
  salle: "Salle 2",
  place: "A2",
  utiliseLe: new Date("2026-11-20T19:05:00Z"),
  ...modification,
});

function depot(reponse: Controle = controle({})) {
  const jetons: string[] = [];
  const d: DepotControle = {
    async controler(jeton) {
      jetons.push(jeton);
      return reponse;
    },
  };
  return { depot: d, jetons };
}

describe("lireJeton", () => {
  it.each([
    [JETON, JETON],
    [`  ${JETON.toUpperCase()}\n`, JETON],
    [`LGC:${JETON}`, JETON],
  ])("retrouve le jeton dans « %s »", (saisie: string, attendu: string) => {
    expect(lireJeton(saisie)).toBe(attendu);
  });

  it.each([[""], ["LGC-8F474T"], ["3f2b8c1e-9a4d"], [null], [42]])(
    "refuse une saisie sans jeton (%o)",
    (saisie: unknown) => {
      expect(lireJeton(saisie)).toBe(null);
    },
  );
});

describe("controlerBillet", () => {
  it("transmet le jeton nettoyé à la base", async () => {
    const { depot: d, jetons } = depot();
    const resultat = await controlerBillet(d, ` ${JETON.toUpperCase()} `);
    expect(resultat.resultat).toBe("accepte");
    expect(jetons).toEqual([JETON]);
  });

  it("répond « inconnu » sans interroger la base quand la saisie n'est pas un jeton", async () => {
    const { depot: d, jetons } = depot();
    const resultat = await controlerBillet(d, "bonjour");
    expect(resultat.resultat).toBe("inconnu");
    expect(jetons).toHaveLength(0);
  });
});

describe("verdict", () => {
  it("autorise l'entrée et rappelle la séance et la place", () => {
    const v = verdict(controle({}));
    expect(v.accepte).toBe(true);
    expect(v.titre).toBe("Entrée autorisée");
    expect(v.detail).toBe("Meilleure Vie — vendredi 20 novembre 2026 à 20:30 — Salle 2, place A2");
  });

  it("refuse un billet déjà utilisé en donnant l'heure du premier passage", () => {
    const v = verdict(controle({ resultat: "deja_utilise" }));
    expect(v.accepte).toBe(false);
    expect(v.titre).toBe("Billet déjà utilisé");
    expect(v.detail).toBe("Entrée déjà enregistrée le 20/11 à 20:05 (place A2).");
    expect(verdict(controle({ resultat: "deja_utilise", utiliseLe: null })).detail).toBe(
      "Entrée déjà enregistrée.",
    );
  });

  it.each([
    ["annule", "Billet annulé"],
    ["seance_annulee", "Séance annulée"],
    ["trop_tot", "Trop tôt"],
    ["seance_terminee", "Séance terminée"],
    ["inconnu", "Billet inconnu"],
  ] as const)("refuse : %s", (resultat: Controle["resultat"], titre: string) => {
    const v = verdict(controle({ resultat }));
    expect(v.accepte).toBe(false);
    expect(v.titre).toBe(titre);
  });

  it("explique quand le contrôle d'une séance ouvre", () => {
    expect(verdict(controle({ resultat: "trop_tot" })).detail).toBe(
      "Meilleure Vie — vendredi 20 novembre 2026 à 20:30. Le contrôle ouvre 60 minutes avant le début de la séance.",
    );
  });

  it("n'affiche pas de séance pour un billet inconnu", () => {
    const v = verdict(controle({ resultat: "annule", film: null, debutSeance: null }));
    expect(v.detail).toBe("");
  });
});
