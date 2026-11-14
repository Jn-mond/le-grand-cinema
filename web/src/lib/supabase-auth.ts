import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { ErreurApplication } from "./erreurs";

/** URL du projet et clé publique : sans danger côté navigateur, car la RLS bloque l'accès aux tables. */
export function configurationAuth(): { url: string; cle: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const cle = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  return url && cle ? { url, cle } : null;
}

/**
 * Client Supabase lié à la session de la personne connectée (cookies). Il sert uniquement à
 * l'authentification : les données sont lues avec le client serveur, après vérification du rôle.
 */
export async function clientAuthServeur() {
  const configuration = configurationAuth();
  if (!configuration) {
    throw new ErreurApplication(
      "CONFIGURATION_MANQUANTE",
      "Configuration incomplète (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)",
    );
  }
  const magasin = await cookies();
  return createServerClient(configuration.url, configuration.cle, {
    cookies: {
      getAll() {
        return magasin.getAll();
      },
      setAll(aEcrire) {
        try {
          for (const { name, value, options } of aEcrire) {
            magasin.set(name, value, options);
          }
        } catch {
          // Appel depuis un Server Component : écriture impossible ici, le proxy rafraîchit la session.
        }
      },
    },
  });
}
