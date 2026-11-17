import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { DemandeSession, PasserellePaiement, SessionPaiement } from "./service";

const API_STRIPE = "https://api.stripe.com/v1";

/** Erreur renvoyée par l'API Stripe (le message n'est jamais montré au client). */
export class ErreurStripe extends Error {
  readonly statut: number;
  readonly code?: string;
  /** Statut du paiement concerné, quand Stripe le joint à l'erreur. */
  readonly statutPaiement?: string;

  constructor(statut: number, message: string, code?: string, statutPaiement?: string) {
    super(message);
    this.name = "ErreurStripe";
    this.statut = statut;
    this.code = code;
    this.statutPaiement = statutPaiement;
  }
}

const schemaErreurStripe = z.object({
  error: z.object({
    message: z.string().optional(),
    code: z.string().optional(),
    payment_intent: z.object({ status: z.string() }).optional(),
  }),
});

/**
 * Accès à Stripe par son API HTTP, sans bibliothèque : les quatre appels utiles tiennent
 * en quelques lignes. La clé secrète est fournie par le serveur (variable STRIPE_SECRET_KEY)
 * et n'est jamais envoyée au navigateur. La page de paiement est hébergée par Stripe :
 * aucune donnée de carte ne transite par l'application.
 */
export class PasserelleStripe implements PasserellePaiement {
  constructor(
    private readonly cleSecrete: string,
    private readonly envoyer: typeof fetch = fetch,
  ) {}

  private async appeler(
    chemin: string,
    parametres: Record<string, string> = {},
    cleIdempotence?: string,
  ): Promise<Record<string, unknown>> {
    const entetes: Record<string, string> = {
      Authorization: `Bearer ${this.cleSecrete}`,
      "Content-Type": "application/x-www-form-urlencoded",
    };
    // Une requête rejouée (double clic, nouvel essai réseau) ne crée pas une seconde session.
    if (cleIdempotence) entetes["Idempotency-Key"] = cleIdempotence;
    const reponse = await this.envoyer(`${API_STRIPE}/${chemin}`, {
      method: "POST",
      headers: entetes,
      body: new URLSearchParams(parametres).toString(),
    });
    const corps: unknown = await reponse.json().catch(() => ({}));
    if (!reponse.ok) {
      const erreur = schemaErreurStripe.safeParse(corps);
      const detail = erreur.success ? erreur.data.error : undefined;
      throw new ErreurStripe(
        reponse.status,
        detail?.message ?? `Stripe : erreur ${reponse.status}`,
        detail?.code,
        detail?.payment_intent?.status,
      );
    }
    return corps as Record<string, unknown>;
  }

  async creerSession(demande: DemandeSession): Promise<SessionPaiement> {
    const session = await this.appeler(
      "checkout/sessions",
      {
        mode: "payment",
        locale: "fr",
        "payment_method_types[0]": "card",
        "line_items[0][quantity]": String(demande.quantite),
        "line_items[0][price_data][currency]": "eur",
        "line_items[0][price_data][unit_amount]": String(demande.prixUnitaireCentimes),
        "line_items[0][price_data][product_data][name]": demande.libelle,
        // Capture différée : la carte est seulement autorisée ; le prélèvement attend les billets.
        "payment_intent_data[capture_method]": "manual",
        "payment_intent_data[metadata][commande_id]": demande.commandeId,
        "metadata[commande_id]": demande.commandeId,
        client_reference_id: demande.reservationId,
        customer_email: demande.email,
        success_url: demande.urlSucces,
        cancel_url: demande.urlAbandon,
        expires_at: String(Math.floor(demande.expireAt.getTime() / 1000)),
      },
      `commande-${demande.commandeId}`,
    );
    const lue = z.object({ id: z.string(), url: z.string() }).safeParse(session);
    if (!lue.success) throw new ErreurStripe(502, "Réponse de Stripe inattendue");
    return lue.data;
  }

  async expirerSession(sessionId: string): Promise<void> {
    await this.appeler(`checkout/sessions/${encodeURIComponent(sessionId)}/expire`);
  }

  async capturer(paiementId: string): Promise<void> {
    await this.toleree(`payment_intents/${encodeURIComponent(paiementId)}/capture`, "succeeded");
  }

  async annuler(paiementId: string): Promise<void> {
    await this.toleree(`payment_intents/${encodeURIComponent(paiementId)}/cancel`, "canceled");
  }

  /** Un webhook rejoué peut demander une capture (ou une annulation) déjà faite : ce n'est pas une erreur. */
  private async toleree(chemin: string, statutDejaAtteint: string): Promise<void> {
    try {
      await this.appeler(chemin);
    } catch (erreur) {
      if (!(erreur instanceof ErreurStripe) || erreur.statutPaiement !== statutDejaAtteint) {
        throw erreur;
      }
    }
  }
}

/** Événement Stripe, réduit à ce que l'application lit. */
export interface EvenementStripe {
  id: string;
  type: string;
  data: { object: Record<string, unknown> };
}

const schemaEvenement = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  data: z.object({ object: z.record(z.string(), z.unknown()) }),
});

/**
 * Vérifie qu'un webhook vient bien de Stripe : l'en-tête Stripe-Signature contient l'heure
 * d'envoi (t) et une signature HMAC-SHA256 (v1) de « t.corps » calculée avec le secret du
 * webhook. Un message trop ancien (rejeu) ou modifié est refusé. Renvoie l'événement, ou null.
 */
export function verifierSignature(
  corps: string,
  entete: string | null,
  secret: string,
  maintenantSecondes: number,
  toleranceSecondes = 300,
): EvenementStripe | null {
  if (!entete || !secret) return null;
  const elements = entete.split(",").map((element) => element.trim().split("="));
  const horodatage = Number(elements.find(([cle]) => cle === "t")?.[1]);
  const signatures = elements.filter(([cle]) => cle === "v1").map(([, valeur]) => valeur ?? "");
  if (!Number.isInteger(horodatage) || signatures.length === 0) return null;
  if (Math.abs(maintenantSecondes - horodatage) > toleranceSecondes) return null;

  const attendue = Buffer.from(
    createHmac("sha256", secret).update(`${horodatage}.${corps}`).digest("hex"),
  );
  const valide = signatures.some((signature) => {
    const recue = Buffer.from(signature);
    return recue.length === attendue.length && timingSafeEqual(recue, attendue);
  });
  if (!valide) return null;

  try {
    const lu = schemaEvenement.safeParse(JSON.parse(corps));
    return lu.success ? lu.data : null;
  } catch {
    return null;
  }
}
