/** Ce que la page de retour du paiement affiche au client. */
export type EtatPaiement =
  | "confirmee" // billets émis
  | "en_cours" // revenu de Stripe, confirmation (webhook) pas encore reçue
  | "non_abouti" // paiement refusé par l'application (places perdues…) : carte non débitée
  | "abandon" // page Stripe quittée, places encore bloquées : le client peut reprendre
  | "a_payer" // places bloquées, aucun paiement en cours
  | "expiree"; // délai dépassé sans paiement

export interface SituationPaiement {
  statutReservation: string;
  /** Statut de la dernière commande de la réservation, s'il y en a une. */
  derniereCommande: string | null;
  /** Fin du blocage des places, si elles sont encore bloquées. */
  bloqueeJusqua: Date | null;
  /** Paramètre « paiement » de l'adresse de retour (succes ou abandon). */
  retour: string | undefined;
}

/** E4 — état à afficher au retour de la page de paiement. */
export function etatPaiement(situation: SituationPaiement, maintenant = new Date()): EtatPaiement {
  const { statutReservation, derniereCommande, bloqueeJusqua, retour } = situation;
  if (statutReservation === "confirmee") return "confirmee";
  if (derniereCommande === "echouee") return "non_abouti";
  if (statutReservation !== "en_attente_paiement") return "expiree";
  // Stripe redirige le client avant que le webhook n'arrive : quelques secondes d'attente.
  if (derniereCommande === "en_attente" && retour === "succes") return "en_cours";
  const bloquee = bloqueeJusqua !== null && bloqueeJusqua.getTime() > maintenant.getTime();
  if (!bloquee) return "expiree";
  return retour === "abandon" || derniereCommande === "abandonnee" ? "abandon" : "a_payer";
}
