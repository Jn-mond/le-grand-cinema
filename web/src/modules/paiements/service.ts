import { z } from "zod";
import { ErreurApplication } from "../../lib/erreurs";

/** Durée de vie de la page de paiement Stripe : 30 minutes au minimum chez Stripe. */
export const DUREE_PAGE_PAIEMENT_MS = 31 * 60 * 1000;

export interface CommandeOuverte {
  commandeId: string;
  montantCentimes: number;
  nbPlaces: number;
  prixUnitaireCentimes: number;
  email: string;
  titreFilm: string;
  debutSeance: Date;
}

/** Résultats de confirmer_commande() (migration 0008). */
export type ResultatConfirmation =
  | "confirmee"
  | "deja_confirmee"
  | "places_perdues"
  | "reservation_close"
  | "montant_incorrect"
  | "introuvable";

export interface DepotPaiements {
  /** Commandes encore en attente d'une réservation, avec leur page de paiement éventuelle. */
  commandesEnAttente(reservationId: string): Promise<{ id: string; sessionId: string | null }[]>;
  ouvrirCommande(
    reservationId: string,
  ): Promise<CommandeOuverte | "introuvable" | "non_modifiable" | "expiree">;
  attacherSession(commandeId: string, sessionId: string): Promise<void>;
  confirmerCommande(
    commandeId: string,
    paiementId: string,
    montantCentimes: number,
  ): Promise<ResultatConfirmation>;
  abandonnerCommande(commandeId: string): Promise<void>;
  /** Enregistre un événement reçu ; false s'il a déjà été traité (webhook rejoué). */
  debuterEvenement(id: string, type: string): Promise<boolean>;
  terminerEvenement(id: string): Promise<void>;
}

export interface DemandeSession {
  commandeId: string;
  reservationId: string;
  libelle: string;
  quantite: number;
  prixUnitaireCentimes: number;
  email: string;
  urlSucces: string;
  urlAbandon: string;
  expireAt: Date;
}

export interface SessionPaiement {
  id: string;
  url: string;
}

export interface PasserellePaiement {
  creerSession(demande: DemandeSession): Promise<SessionPaiement>;
  expirerSession(sessionId: string): Promise<void>;
  /** Prélève un paiement autorisé. */
  capturer(paiementId: string): Promise<void>;
  /** Annule l'autorisation : le client n'est pas débité. */
  annuler(paiementId: string): Promise<void>;
}

/**
 * E4 — ouvre une commande pour les places bloquées et renvoie l'adresse de la page de
 * paiement Stripe. Une page ouverte plus tôt pour la même réservation est fermée d'abord :
 * le client ne peut pas payer deux fois les mêmes places.
 */
export async function demarrerPaiement(
  depot: DepotPaiements,
  passerelle: PasserellePaiement,
  reservationId: string,
  urls: { succes: string; abandon: string },
  maintenant: Date = new Date(),
): Promise<string> {
  for (const ancienne of await depot.commandesEnAttente(reservationId)) {
    if (ancienne.sessionId) {
      // Déjà expirée ou déjà payée : Stripe refuse, et le webhook réglera le cas payé.
      await passerelle.expirerSession(ancienne.sessionId).catch(() => undefined);
    }
    await depot.abandonnerCommande(ancienne.id);
  }

  const commande = await depot.ouvrirCommande(reservationId);
  if (commande === "introuvable") {
    throw new ErreurApplication("RESERVATION_INTROUVABLE", "Réservation introuvable");
  }
  if (commande === "non_modifiable") {
    throw new ErreurApplication(
      "RESERVATION_NON_MODIFIABLE",
      "Cette réservation n’est plus en attente de paiement",
    );
  }
  if (commande === "expiree") {
    throw new ErreurApplication(
      "RESERVATION_EXPIREE",
      "Le délai de 10 minutes est dépassé : vos places ont été libérées",
    );
  }

  const session = await passerelle.creerSession({
    commandeId: commande.commandeId,
    reservationId,
    libelle: `${commande.titreFilm} — séance du ${formaterSeance(commande.debutSeance)}`,
    quantite: commande.nbPlaces,
    prixUnitaireCentimes: commande.prixUnitaireCentimes,
    email: commande.email,
    urlSucces: urls.succes,
    urlAbandon: urls.abandon,
    expireAt: new Date(maintenant.getTime() + DUREE_PAGE_PAIEMENT_MS),
  });
  await depot.attacherSession(commande.commandeId, session.id);
  return session.url;
}

function formaterSeance(date: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Europe/Paris",
  }).format(date);
}

/** Partie de la session Checkout lue dans les webhooks. */
const schemaSessionCheckout = z.object({
  payment_intent: z.string().nullish(),
  amount_total: z.number().int().nullish(),
  metadata: z.object({ commande_id: z.string().optional() }).nullish(),
});

export type IssueEvenement = ResultatConfirmation | "abandonnee" | "ignore" | "deja_traite";

/**
 * E4 — traite un événement Stripe déjà authentifié (signature vérifiée).
 * - checkout.session.completed : la carte est autorisée. Les billets sont créés si les places
 *   sont toujours disponibles, puis le paiement est prélevé ; sinon l'autorisation est annulée.
 * - checkout.session.expired : la page de paiement a expiré, la commande est abandonnée.
 * Un événement n'est marqué traité qu'à la fin : en cas d'erreur, Stripe le renvoie et le
 * traitement reprend sans doublon (confirmation, capture et annulation sont rejouables).
 */
export async function traiterEvenement(
  depot: DepotPaiements,
  passerelle: PasserellePaiement,
  evenement: { id: string; type: string; data: { object: Record<string, unknown> } },
): Promise<IssueEvenement> {
  const termine = evenement.type === "checkout.session.completed";
  const expire = evenement.type === "checkout.session.expired";
  if (!termine && !expire) return "ignore";

  const session = schemaSessionCheckout.safeParse(evenement.data.object);
  const commandeId = session.success ? session.data.metadata?.commande_id : undefined;
  if (!session.success || !commandeId) return "ignore"; // session créée hors de l'application

  if (!(await depot.debuterEvenement(evenement.id, evenement.type))) return "deja_traite";

  let issue: IssueEvenement = "abandonnee";
  if (expire) {
    await depot.abandonnerCommande(commandeId);
  } else {
    const paiementId = session.data.payment_intent;
    if (!paiementId) {
      issue = "ignore";
    } else {
      issue = await depot.confirmerCommande(
        commandeId,
        paiementId,
        session.data.amount_total ?? -1,
      );
      if (issue === "confirmee" || issue === "deja_confirmee") {
        await passerelle.capturer(paiementId);
      } else {
        await passerelle.annuler(paiementId);
      }
    }
  }
  await depot.terminerEvenement(evenement.id);
  return issue;
}
