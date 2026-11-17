"use client";

import { useActionState, useEffect, useRef } from "react";
import { controler, type EtatControle } from "./actions";

const ETAT_INITIAL: EtatControle = { passage: 0 };

/**
 * Poste de contrôle : une douchette lit le QR code et le « tape » dans le champ, suivi
 * d'Entrée ; le code imprimé sous le QR peut aussi être saisi à la main. Après chaque
 * passage, le champ se vide et reprend la main pour le billet suivant.
 */
export function PosteControle() {
  const [etat, action, enCours] = useActionState(controler, ETAT_INITIAL);
  const champ = useRef<HTMLInputElement>(null);
  useEffect(() => {
    champ.current?.focus();
  }, [etat.passage]);

  return (
    <>
      <form action={action} className="formulaire">
        <label htmlFor="jeton">Code du billet (scanner le QR code ou saisir le code)</label>
        <input
          ref={champ}
          id="jeton"
          name="jeton"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          required
          disabled={enCours}
        />
        <button type="submit" disabled={enCours} aria-busy={enCours}>
          {enCours ? "Vérification…" : "Contrôler"}
        </button>
      </form>
      {etat.verdict ? (
        <section
          key={etat.passage}
          role="status"
          className={`verdict ${etat.verdict.accepte ? "verdict-ok" : "verdict-refus"}`}
        >
          <p className="verdict-titre">
            {etat.verdict.accepte ? "✓" : "✕"} {etat.verdict.titre}
          </p>
          {etat.verdict.detail ? <p>{etat.verdict.detail}</p> : null}
        </section>
      ) : null}
    </>
  );
}
