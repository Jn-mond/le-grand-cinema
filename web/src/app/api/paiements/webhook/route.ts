import { reponseJson } from "@/lib/http";
import { passerelleStripe } from "@/lib/stripe-serveur";
import { clientSupabaseServeur } from "@/lib/supabase-serveur";
import { DepotPaiementsSupabase } from "@/modules/paiements/depot-supabase";
import { traiterEvenement } from "@/modules/paiements/service";
import { verifierSignature } from "@/modules/paiements/stripe";

/**
 * POST /api/paiements/webhook — événements envoyés par Stripe (E4).
 * Le corps est lu tel quel : la signature porte sur les octets reçus, pas sur un JSON relu.
 * Réponse 2xx : Stripe considère l'événement livré. Réponse 5xx : Stripe le renvoie plus tard
 * (jusqu'à trois jours en mode réel), et le traitement reprend sans doublon.
 */
export async function POST(requete: Request): Promise<Response> {
  const corps = await requete.text();
  const evenement = verifierSignature(
    corps,
    requete.headers.get("stripe-signature"),
    process.env.STRIPE_WEBHOOK_SECRET ?? "",
    Math.floor(Date.now() / 1000),
  );
  if (!evenement) return reponseJson({ recu: false, erreur: "Signature invalide" }, 400);

  try {
    const issue = await traiterEvenement(
      new DepotPaiementsSupabase(clientSupabaseServeur()),
      passerelleStripe(),
      evenement,
    );
    return reponseJson({ recu: true, issue });
  } catch (erreur) {
    console.error(`Webhook ${evenement.type} (${evenement.id}) non traité`, erreur);
    return reponseJson({ recu: false }, 500);
  }
}
