"use client";

import { useActionState } from "react";
import { formaterPrix } from "@/lib/dates";
import { payer, type EtatPaiementAction } from "./actions";

const ETAT_INITIAL: EtatPaiementAction = { message: "" };

/** E4 — bouton « Payer » : ouvre la page de paiement Stripe (carte de test en mode test). */
export function BoutonPayer({
  reservationId,
  montantCentimes,
}: {
  reservationId: string;
  montantCentimes: number;
}) {
  const [etat, action, enCours] = useActionState(payer, ETAT_INITIAL);
  return (
    <form action={action} className="formulaire">
      <input type="hidden" name="reservationId" value={reservationId} />
      {etat.message ? (
        <p role="alert" className="erreur">
          {etat.message}
        </p>
      ) : null}
      <button type="submit" disabled={enCours} aria-busy={enCours}>
        {enCours ? "Ouverture du paiement…" : `Payer ${formaterPrix(montantCentimes)}`}
      </button>
      <p className="discret">
        Paiement sécurisé par Stripe : vos données de carte ne nous parviennent pas.
      </p>
    </form>
  );
}
