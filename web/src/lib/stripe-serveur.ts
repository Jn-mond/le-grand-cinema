import "server-only";
import { PasserelleStripe } from "@/modules/paiements/stripe";
import { ErreurApplication } from "./erreurs";

/**
 * Accès à Stripe côté serveur. La clé secrète (sk_test_… en mode test) reste sur le serveur :
 * ce module ne peut pas être importé dans un composant client (« server-only »).
 */
export function passerelleStripe(): PasserelleStripe {
  const cle = process.env.STRIPE_SECRET_KEY;
  if (!cle) {
    throw new ErreurApplication(
      "CONFIGURATION_MANQUANTE",
      "Configuration du serveur incomplète (STRIPE_SECRET_KEY)",
    );
  }
  return new PasserelleStripe(cle);
}
