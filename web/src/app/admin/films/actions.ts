"use server";

import { refresh } from "next/cache";
import { ErreurApplication } from "@/lib/erreurs";
import { utilisateurConnecte } from "@/lib/session";
import { clientSupabaseServeur } from "@/lib/supabase-serveur";
import { schemaIdentifiantFilm } from "@/modules/films/fiche";
import {
  enregistrerFilm,
  lireFormulaireFilm,
  messageSaisie,
  schemaFilm,
} from "@/modules/films/gestion";
import { DepotGestionFilmsSupabase } from "@/modules/films/gestion-supabase";
import { valider } from "@/modules/reservations/schemas";
import { peutProgrammer } from "@/modules/utilisateurs/roles";

export interface EtatFormulaireFilm {
  succes: boolean;
  message: string;
}

/** E7 — créer un film (champ id absent) ou le modifier. Le rôle est revérifié côté serveur. */
export async function actionEnregistrerFilm(
  _etat: EtatFormulaireFilm,
  donnees: FormData,
): Promise<EtatFormulaireFilm> {
  const utilisateur = await utilisateurConnecte();
  if (!utilisateur || !peutProgrammer(utilisateur.role)) {
    return { succes: false, message: "Action réservée à la programmation." };
  }
  try {
    const idSaisi = donnees.get("id");
    const id = idSaisi === null ? null : valider(schemaIdentifiantFilm, idSaisi);
    const film = valider(schemaFilm, lireFormulaireFilm(donnees));
    await enregistrerFilm(new DepotGestionFilmsSupabase(clientSupabaseServeur()), film, id);
    refresh();
    return {
      succes: true,
      message: id === null ? `Film « ${film.titre} » ajouté.` : "Modifications enregistrées.",
    };
  } catch (erreur) {
    if (erreur instanceof ErreurApplication) {
      return { succes: false, message: messageSaisie(erreur) };
    }
    console.error("Enregistrement du film impossible", erreur);
    return { succes: false, message: "Erreur inattendue : le film n’a pas été enregistré." };
  }
}
