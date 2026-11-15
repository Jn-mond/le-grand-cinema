"use client";

import { useActionState } from "react";
import { actionChangerPublication, type EtatPublication } from "./actions";

const ETAT_INITIAL: EtatPublication = { erreur: "" };

/** Bouton « Publier » ou « Retirer du site » d'une ligne du tableau des séances (E7). */
export function BoutonPublication({ seanceId, statut }: { seanceId: number; statut: string }) {
  const [etat, action, enCours] = useActionState(actionChangerPublication, ETAT_INITIAL);
  if (statut !== "publiee" && statut !== "brouillon") return null;
  const publier = statut === "brouillon";
  return (
    <form action={action} className="action-ligne">
      <input type="hidden" name="seanceId" value={seanceId} />
      <input type="hidden" name="action" value={publier ? "publier" : "retirer"} />
      <button type="submit" disabled={enCours} aria-busy={enCours}>
        {publier ? "Publier" : "Retirer du site"}
      </button>
      {etat.erreur ? (
        <p role="alert" className="erreur">
          {etat.erreur}
        </p>
      ) : null}
    </form>
  );
}
