"use client";

import { useActionState } from "react";
import { seConnecter, type EtatConnexion } from "./actions";

const ETAT_INITIAL: EtatConnexion = { erreur: null };

export function FormulaireConnexion() {
  const [etat, action, enCours] = useActionState(seConnecter, ETAT_INITIAL);
  return (
    <form action={action} className="formulaire">
      <label htmlFor="email">Adresse e-mail</label>
      <input id="email" name="email" type="email" autoComplete="email" required />
      <label htmlFor="motDePasse">Mot de passe</label>
      <input
        id="motDePasse"
        name="motDePasse"
        type="password"
        autoComplete="current-password"
        required
      />
      {etat.erreur ? (
        <p role="alert" className="erreur">
          {etat.erreur}
        </p>
      ) : null}
      <button type="submit" disabled={enCours}>
        {enCours ? "Connexion…" : "Se connecter"}
      </button>
    </form>
  );
}
