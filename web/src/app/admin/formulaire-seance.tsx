"use client";

import { useActionState } from "react";
import { valeurInitiale } from "@/lib/formulaire";
import type { Choix } from "@/modules/seances/catalogue-supabase";
import { actionProgrammerSeance, type EtatFormulaireSeance } from "./actions";

const ETAT_INITIAL: EtatFormulaireSeance = { succes: false, message: "" };

export function FormulaireSeance({ films, salles }: { films: Choix[]; salles: Choix[] }) {
  const [etat, action, enCours] = useActionState(actionProgrammerSeance, ETAT_INITIAL);
  // Après un refus (créneau occupé, date passée…), la saisie est conservée.
  const saisie = etat.succes ? undefined : etat.valeurs;
  return (
    <form action={action} className="formulaire grille">
      {/* Les clés des listes déroulantes les recréent avec la saisie refusée : React ne remet pas
          une liste sur sa nouvelle valeur par défaut lors de la remise à zéro du formulaire. */}
      <label htmlFor="filmId">Film</label>
      <select
        key={`film-${valeurInitiale(saisie, "filmId", "")}`}
        id="filmId"
        name="filmId"
        required
        defaultValue={valeurInitiale(saisie, "filmId", "")}
      >
        {films.map((film) => (
          <option key={film.id} value={film.id}>
            {film.libelle}
          </option>
        ))}
      </select>

      <label htmlFor="salleId">Salle</label>
      <select
        key={`salle-${valeurInitiale(saisie, "salleId", "")}`}
        id="salleId"
        name="salleId"
        required
        defaultValue={valeurInitiale(saisie, "salleId", "")}
      >
        {salles.map((salle) => (
          <option key={salle.id} value={salle.id}>
            {salle.libelle}
          </option>
        ))}
      </select>

      <label htmlFor="debut">Début (heure de Paris)</label>
      <input
        id="debut"
        name="debut"
        type="datetime-local"
        required
        defaultValue={valeurInitiale(saisie, "debut", "")}
      />

      <label htmlFor="version">Version</label>
      <select
        key={`version-${valeurInitiale(saisie, "version", "vf")}`}
        id="version"
        name="version"
        defaultValue={valeurInitiale(saisie, "version", "vf")}
      >
        <option value="vf">VF</option>
        <option value="vostfr">VOSTFR</option>
        <option value="vo">VO</option>
      </select>

      <label htmlFor="prix">Prix (€)</label>
      <input
        id="prix"
        name="prix"
        inputMode="decimal"
        placeholder="12,50"
        required
        defaultValue={valeurInitiale(saisie, "prix", "")}
      />

      <label className="case">
        <input
          name="publier"
          type="checkbox"
          defaultChecked={saisie ? saisie.publier === "on" : true}
        />{" "}
        Publier sur le site
      </label>

      {etat.message ? (
        <p role="status" className={etat.succes ? "succes" : "erreur"}>
          {etat.message}
        </p>
      ) : null}
      <button type="submit" disabled={enCours} aria-busy={enCours}>
        {enCours ? "Enregistrement…" : "Programmer la séance"}
      </button>
    </form>
  );
}
