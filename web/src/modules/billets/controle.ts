import { formaterDateHeure, formaterJourHeure } from "../../lib/dates";

/** Résultats de controler_billet() (migration 0009). */
export type ResultatControle =
  | "accepte"
  | "deja_utilise"
  | "annule"
  | "seance_annulee"
  | "trop_tot"
  | "seance_terminee"
  | "inconnu";

export interface Controle {
  resultat: ResultatControle;
  film: string | null;
  debutSeance: Date | null;
  salle: string | null;
  /** Place au format du plan de salle, par exemple « A2 ». */
  place: string | null;
  /** Heure du passage qui a utilisé le billet. */
  utiliseLe: Date | null;
}

export interface DepotControle {
  /** Contrôle atomique : marque le billet utilisé s'il est accepté (une seule fois). */
  controler(jeton: string): Promise<Controle>;
}

const JETON = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

const INCONNU: Controle = {
  resultat: "inconnu",
  film: null,
  debutSeance: null,
  salle: null,
  place: null,
  utiliseLe: null,
};

/**
 * Jeton lu dans la saisie du poste de contrôle. Une douchette tape le contenu du QR code comme
 * un clavier : espaces, retour à la ligne ou majuscules sont tolérés. Null si aucun jeton.
 */
export function lireJeton(saisie: unknown): string | null {
  if (typeof saisie !== "string") return null;
  const trouve = JETON.exec(saisie);
  return trouve ? trouve[0].toLowerCase() : null;
}

/** E5 — contrôle d'un billet à l'entrée. Une saisie qui n'est pas un jeton n'interroge pas la base. */
export async function controlerBillet(depot: DepotControle, saisie: unknown): Promise<Controle> {
  const jeton = lireJeton(saisie);
  return jeton ? depot.controler(jeton) : INCONNU;
}

export interface Verdict {
  accepte: boolean;
  titre: string;
  detail: string;
}

/** Ce que le poste de contrôle affiche, en grand, après un passage. */
export function verdict(controle: Controle): Verdict {
  const seance =
    controle.film && controle.debutSeance
      ? `${controle.film} — ${formaterDateHeure(controle.debutSeance)}`
      : "";
  switch (controle.resultat) {
    case "accepte":
      return {
        accepte: true,
        titre: "Entrée autorisée",
        detail: `${seance} — ${controle.salle}, place ${controle.place}`,
      };
    case "deja_utilise":
      return {
        accepte: false,
        titre: "Billet déjà utilisé",
        detail: controle.utiliseLe
          ? `Entrée déjà enregistrée le ${formaterJourHeure(controle.utiliseLe)} (place ${controle.place}).`
          : "Entrée déjà enregistrée.",
      };
    case "annule":
      return { accepte: false, titre: "Billet annulé", detail: seance };
    case "seance_annulee":
      return { accepte: false, titre: "Séance annulée", detail: seance };
    case "trop_tot":
      return {
        accepte: false,
        titre: "Trop tôt",
        detail: `${seance}. Le contrôle ouvre 60 minutes avant le début de la séance.`,
      };
    case "seance_terminee":
      return { accepte: false, titre: "Séance terminée", detail: seance };
    default:
      return {
        accepte: false,
        titre: "Billet inconnu",
        detail:
          "Ce code ne correspond à aucun billet. Scannez à nouveau ou saisissez le code imprimé.",
      };
  }
}
