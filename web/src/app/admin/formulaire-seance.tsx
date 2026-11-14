"use client";

import { useActionState } from "react";
import type { Choix } from "@/modules/seances/catalogue-supabase";
import { actionProgrammerSeance, type EtatFormulaireSeance } from "./actions";

const ETAT_INITIAL: EtatFormulaireSeance = { succes: false, message: "" };

export function FormulaireSeance({ films, salles }: { films: Choix[]; salles: Choix[] }) {
  const [etat, action, enCours] = useActionState(actionProgrammerSeance, ETAT_INITIAL);
  return (
    <form action={action} className="formulaire grille">
      <label htmlFor="filmId">Film</label>
      <select id="filmId" name="filmId" required>
        {films.map((film) => (
          <option key={film.id} value={film.id}>
            {film.libelle}
          </option>
        ))}
      </select>

      <label htmlFor="salleId">Salle</label>
      <select id="salleId" name="salleId" required>
        {salles.map((salle) => (
          <option key={salle.id} value={salle.id}>
            {salle.libelle}
          </option>
        ))}
      </select>

      <label htmlFor="debut">Début (heure de Paris)</label>
      <input id="debut" name="debut" type="datetime-local" required />

      <label htmlFor="version">Version</label>
      <select id="version" name="version" defaultValue="vf">
        <option value="vf">VF</option>
        <option value="vostfr">VOSTFR</option>
        <option value="vo">VO</option>
      </select>

      <label htmlFor="prix">Prix (€)</label>
      <input id="prix" name="prix" inputMode="decimal" placeholder="12,50" required />

      <label className="case">
        <input name="publier" type="checkbox" defaultChecked /> Publier sur le site
      </label>

      {etat.message ? (
        <p role="status" className={etat.succes ? "succes" : "erreur"}>
          {etat.message}
        </p>
      ) : null}
      <button type="submit" disabled={enCours}>
        {enCours ? "Enregistrement…" : "Programmer la séance"}
      </button>
    </form>
  );
}
