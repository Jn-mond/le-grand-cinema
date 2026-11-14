import "server-only";
import { cache } from "react";
import { lireProfil } from "@/modules/utilisateurs/depot-supabase";
import type { Profil } from "@/modules/utilisateurs/roles";
import { clientAuthServeur, configurationAuth } from "./supabase-auth";
import { clientSupabaseServeur } from "./supabase-serveur";

/**
 * Personne connectée, ou null. Point d'entrée unique pour l'identité (« Data Access Layer ») :
 * la session est vérifiée auprès de Supabase Auth (getUser), jamais simplement lue dans le cookie.
 * Mémorisé le temps d'une requête (cache de React) pour ne pas interroger Supabase plusieurs fois.
 */
export const utilisateurConnecte = cache(async (): Promise<Profil | null> => {
  if (!configurationAuth()) {
    console.error("Connexion indisponible : variables NEXT_PUBLIC_SUPABASE_* absentes");
    return null;
  }
  const supabase = await clientAuthServeur();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return lireProfil(clientSupabaseServeur(), data.user.id);
});
