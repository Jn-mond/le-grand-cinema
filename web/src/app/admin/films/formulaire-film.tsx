"use client";

import { useActionState } from "react";
import { libelleAge } from "@/modules/films/fiche";
import { AGES_MINIMUMS } from "@/modules/films/gestion";
import type { FilmEditable } from "@/modules/films/gestion-supabase";
import type { Choix } from "@/modules/seances/catalogue-supabase";
import { actionEnregistrerFilm, type EtatFormulaireFilm } from "./actions";

const ETAT_INITIAL: EtatFormulaireFilm = { succes: false, message: "" };

/** E7 — formulaire commun à la création (sans film) et à la modification d'un film. */
export function FormulaireFilm({ genres, film }: { genres: Choix[]; film?: FilmEditable }) {
  const [etat, action, enCours] = useActionState(actionEnregistrerFilm, ETAT_INITIAL);
  const coches = new Set(film?.genres ?? []);
  return (
    <form action={action} className="formulaire">
      {film ? <input type="hidden" name="id" value={film.id} /> : null}

      <label htmlFor="titre">Titre</label>
      <input id="titre" name="titre" required maxLength={150} defaultValue={film?.titre} />

      <label htmlFor="titreOriginal">Titre original (facultatif)</label>
      <input
        id="titreOriginal"
        name="titreOriginal"
        maxLength={150}
        defaultValue={film?.titreOriginal ?? ""}
      />

      <label htmlFor="dureeMinutes">Durée (minutes)</label>
      <input
        id="dureeMinutes"
        name="dureeMinutes"
        type="number"
        min={1}
        max={600}
        required
        defaultValue={film?.dureeMinutes}
      />

      <label htmlFor="ageMinimum">Public</label>
      <select id="ageMinimum" name="ageMinimum" defaultValue={film?.ageMinimum ?? 0}>
        {AGES_MINIMUMS.map((age) => (
          <option key={age} value={age}>
            {libelleAge(age)}
          </option>
        ))}
      </select>

      <label htmlFor="dateSortie">Date de sortie (facultative)</label>
      <input id="dateSortie" name="dateSortie" type="date" defaultValue={film?.dateSortie ?? ""} />

      <label htmlFor="synopsis">Synopsis (facultatif)</label>
      <textarea
        id="synopsis"
        name="synopsis"
        rows={4}
        maxLength={2000}
        defaultValue={film?.synopsis ?? ""}
      />

      <label htmlFor="afficheUrl">Adresse de l’affiche (https, facultative)</label>
      <input
        id="afficheUrl"
        name="afficheUrl"
        type="url"
        maxLength={500}
        placeholder="https://"
        defaultValue={film?.afficheUrl ?? ""}
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
        <input name="actif" type="checkbox" defaultChecked={film?.actif ?? true} /> Film actif
        (proposé à la programmation et visible sur sa fiche)
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
