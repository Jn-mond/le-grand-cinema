"use server";

import { utilisateurConnecte } from "@/lib/session";
import { clientSupabaseServeur } from "@/lib/supabase-serveur";
import { controlerBillet, verdict, type Verdict } from "@/modules/billets/controle";
import { DepotControleSupabase } from "@/modules/billets/depot-supabase";
import { peutControlerBillets } from "@/modules/utilisateurs/roles";

export interface EtatControle {
  verdict?: Verdict;
  /** Numéro du passage, pour que deux scans identiques de suite restent visibles comme deux résultats. */
  passage: number;
}

/**
 * E5 — contrôle d'un billet à l'entrée : poste de contrôle → serveur → PostgreSQL.
 * Le rôle est revérifié ici, à chaque passage : l'action est appelable sans passer par la page.
 */
export async function controler(etat: EtatControle, donnees: FormData): Promise<EtatControle> {
  const passage = etat.passage + 1;
  const utilisateur = await utilisateurConnecte();
  if (!utilisateur || !peutControlerBillets(utilisateur.role)) {
    return {
      passage,
      verdict: { accepte: false, titre: "Accès refusé", detail: "Contrôle réservé au personnel." },
    };
  }
  try {
    const controle = await controlerBillet(
      new DepotControleSupabase(clientSupabaseServeur()),
      donnees.get("jeton"),
    );
    return { passage, verdict: verdict(controle) };
  } catch (erreur) {
    console.error("Contrôle du billet impossible", erreur);
    return {
      passage,
      verdict: {
        accepte: false,
        titre: "Contrôle indisponible",
        detail: "Le billet n’a pas été vérifié : réessayez, ou contrôlez la liste de la séance.",
      },
    };
  }
}
