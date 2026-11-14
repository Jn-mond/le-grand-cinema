"use server";

import { refresh } from "next/cache";
import { formaterDateHeure } from "@/lib/dates";
import { ErreurApplication } from "@/lib/erreurs";
import { utilisateurConnecte } from "@/lib/session";
import { clientSupabaseServeur } from "@/lib/supabase-serveur";
import { valider } from "@/modules/reservations/schemas";
import { programmerSeance, schemaProgrammation } from "@/modules/seances/programmation";
import { DepotProgrammationSupabase } from "@/modules/seances/programmation-supabase";
import { peutProgrammer } from "@/modules/utilisateurs/roles";

export interface EtatFormulaireSeance {
  succes: boolean;
  message: string;
}

/** E7 — programmer une séance. Le rôle est revérifié ici : l'interface seule ne protège rien. */
export async function actionProgrammerSeance(
  _etat: EtatFormulaireSeance,
  donnees: FormData,
): Promise<EtatFormulaireSeance> {
  const utilisateur = await utilisateurConnecte();
  if (!utilisateur || !peutProgrammer(utilisateur.role)) {
    return { succes: false, message: "Action réservée à la programmation." };
  }
  try {
    const saisie = valider(schemaProgrammation, Object.fromEntries(donnees));
    const seance = await programmerSeance(
      new DepotProgrammationSupabase(clientSupabaseServeur()),
      saisie,
    );
    refresh();
    const etat = seance.statut === "publiee" ? "publiée" : "enregistrée en brouillon";
    return { succes: true, message: `Séance ${etat} : ${formaterDateHeure(seance.debutAt)}.` };
  } catch (erreur) {
    if (erreur instanceof ErreurApplication) {
      return { succes: false, message: erreur.message };
    }
    console.error("Programmation impossible", erreur);
    return { succes: false, message: "Erreur inattendue : la séance n’a pas été créée." };
  }
}
