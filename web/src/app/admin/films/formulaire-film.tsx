"use client";

import { useActionState } from "react";
import { valeurInitiale } from "@/lib/formulaire";
import { libelleAge } from "@/modules/films/fiche";
import { AGES_MINIMUMS } from "@/modules/films/gestion";
import type { FilmEditable } from "@/modules/films/gestion-supabase";
import type { Choix } from "@/modules/seances/catalogue-supabase";
import { actionEnregistrerFilm, type EtatFormulaireFilm } from "./actions";

const ETAT_INITIAL: EtatFormulaireFilm = { succes: false, message: "" };

/** E7 — formulaire commun à la création (sans film) et à la modification d'un film. */
export function FormulaireFilm({ genres, film }: { genres: Choix[]; film?: FilmEditable }) {
  const [etat, action, enCours] = useActionState(actionEnregistrerFilm, ETAT_INITIAL);
  // Après un refus, le formulaire repart de la saisie refusée plutôt que de se vider.
  const saisie = etat.succes ? undefined : etat.valeurs;
  const val = (champ: string, parDefaut: string | number | null | undefined) =>
    valeurInitiale(saisie, champ, parDefaut == null ? "" : String(parDefaut));
  const coches = new Set(saisie ? (saisie.genres as string[]).map(Number) : (film?.genres ?? []));
  const actif = saisie ? saisie.actif === "on" : (film?.actif ?? true);
  return (
    <form action={action} className="formulaire">
      {film ? <input type="hidden" name="id" value={film.id} /> : null}

      <label htmlFor="titre">Titre</label>
      <input
        id="titre"
        name="titre"
        required
        maxLength={150}
        defaultValue={val("titre", film?.titre)}
      />

      <label htmlFor="titreOriginal">Titre original (facultatif)</label>
      <input
        id="titreOriginal"
        name="titreOriginal"
        maxLength={150}
        defaultValue={val("titreOriginal", film?.titreOriginal)}
      />

      <label htmlFor="dureeMinutes">Durée (minutes)</label>
      <input
        id="dureeMinutes"
        name="dureeMinutes"
        type="number"
        min={1}
        max={600}
        required
        defaultValue={val("dureeMinutes", film?.dureeMinutes)}
      />

      <label htmlFor="ageMinimum">Public</label>
      {/* La clé recrée la liste quand la valeur à afficher change : React ne remet pas une
          liste déroulante sur sa nouvelle valeur par défaut lors de la remise à zéro du formulaire. */}
      <select
        key={`age-${val("ageMinimum", film?.ageMinimum ?? 0)}`}
        id="ageMinimum"
        name="ageMinimum"
        defaultValue={val("ageMinimum", film?.ageMinimum ?? 0)}
      >
        {AGES_MINIMUMS.map((age) => (
          <option key={age} value={age}>
            {libelleAge(age)}
          </option>
        ))}
      </select>

      <label htmlFor="dateSortie">Date de sortie (facultative)</label>
      <input
        id="dateSortie"
        name="dateSortie"
        type="date"
        defaultValue={val("dateSortie", film?.dateSortie)}
      />

      <label htmlFor="synopsis">Synopsis (facultatif)</label>
      <textarea
        id="synopsis"
        name="synopsis"
        rows={4}
        maxLength={2000}
        defaultValue={val("synopsis", film?.synopsis)}
      />

      <label htmlFor="afficheUrl">Adresse de l’affiche (https, facultative)</label>
      <input
        id="afficheUrl"
        name="afficheUrl"
        type="url"
        maxLength={500}
        placeholder="https://"
        defaultValue={val("afficheUrl", film?.afficheUrl)}
      />

      <fieldset className="genres">
        <legend>Genres</legend>
        {genres.map((genre) => (
          <label key={genre.id} className="case">
            <input
              type="checkbox"
              name="genres"
              value={genre.id}
              defaultChecked={coches.has(genre.id)}
            />{" "}
            {genre.libelle}
          </label>
        ))}
      </fieldset>

      <label className="case">
        <input name="actif" type="checkbox" defaultChecked={actif} /> Film actif (proposé à la
        programmation et visible sur sa fiche)
      </label>

      {etat.message ? (
        <p role="status" className={etat.succes ? "succes" : "erreur"}>
          {etat.message}
        </p>
      ) : null}
      <button type="submit" disabled={enCours} aria-busy={enCours}>
        {enCours ? "Enregistrement…" : film ? "Enregistrer les modifications" : "Ajouter le film"}
      </button>
    </form>
  );
}
