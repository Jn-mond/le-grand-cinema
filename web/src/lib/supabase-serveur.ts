import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ErreurApplication } from "./erreurs";

let client: SupabaseClient | undefined;

/**
 * Client Supabase côté serveur, avec la clé secrète. Ce module ne peut pas être
 * importé dans un composant client (« server-only ») : la clé ne quitte jamais le serveur.
 */
export function clientSupabaseServeur(): SupabaseClient {
  if (!client) {
    const url = process.env.SUPABASE_URL;
    const cle = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !cle) {
      throw new ErreurApplication(
        "CONFIGURATION_MANQUANTE",
        "Configuration du serveur incomplète (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)",
      );
    }
    client = createClient(url, cle, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}
