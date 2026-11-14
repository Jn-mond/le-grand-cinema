"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { formaterPrix } from "@/lib/dates";
import { MAX_PLACES_PAR_RESERVATION } from "@/modules/reservations/regles";
import type { PlaceDeSeance } from "@/modules/seances/depot";
import { descriptionPlace, libellePlace, organiserPlan } from "@/modules/seances/plan";
import { reserverPlaces, type EtatReservation } from "./actions";

const ETAT_INITIAL: EtatReservation = { statut: "initial", message: "" };

interface Props {
  seanceId: number;
  places: PlaceDeSeance[];
  prixCentimes: number;
  emailConnecte: string | null;
}

export function PlanDeSalle({ seanceId, places, prixCentimes, emailConnecte }: Props) {
  const [choix, setChoix] = useState<number[]>([]);
  // Champs contrôlés : la saisie reste en place si la réservation est refusée.
  const [email, setEmail] = useState("");
  const [nomClient, setNomClient] = useState("");
  const [etat, action, enCours] = useActionState(reserverPlaces, ETAT_INITIAL);
  const bloquee = etat.statut === "bloquee";

  // Une place prise entre-temps (plan rafraîchi après un refus) sort de la sélection.
  const libres = new Set(places.filter((p) => p.etat === "libre").map((p) => p.id));
  const selection = choix.filter((id) => libres.has(id));
  const parId = new Map(places.map((p) => [p.id, p]));
  const libelles = (ids: number[]) =>
    ids
      .map((id) => parId.get(id))
      .filter((p): p is PlaceDeSeance => p !== undefined)
      .map(libellePlace)
      .join(", ");

  function basculer(id: number) {
    setChoix((actuel) => {
      if (actuel.includes(id)) return actuel.filter((x) => x !== id);
      if (actuel.length >= MAX_PLACES_PAR_RESERVATION) return actuel;
      return [...actuel, id];
    });
  }

  if (bloquee) {
    return (
      <section className="carte recapitulatif" aria-live="polite">
        <h2>Places bloquées</h2>
        <p>
          Référence : <strong>{etat.reference}</strong>
        </p>
        <p>Places : {libelles(etat.placeIds ?? [])}</p>
        <p>Total : {formaterPrix((etat.placeIds?.length ?? 0) * prixCentimes)}</p>
        {etat.expireAt ? <CompteARebours expireAt={etat.expireAt} /> : null}
        <p className="discret">
          Le paiement en ligne (EPIC E4) arrive dans une prochaine version : passé le délai, les
          places sont libérées automatiquement.
        </p>
        {emailConnecte ? (
          <p>
            <Link href="/espace">Voir mes réservations</Link>
          </p>
        ) : null}
      </section>
    );
  }

  return (
    <div className="colonnes plan-et-panier">
      <section className="carte">
        <h2>Choisissez vos places</h2>
        <div className="plan" role="group" aria-label="Plan de salle">
          <p className="ecran">Écran</p>
          {organiserPlan(places).map((rangee) => (
            <div key={rangee.rangee} className="rangee">
              <span className="nom-rangee">{rangee.rangee}</span>
              {rangee.places.map((place) => {
                const choisie = selection.includes(place.id);
                const classes = ["siege", place.etat];
                if (choisie) classes.push("choisie");
                if (place.accessiblePmr) classes.push("pmr");
                return (
                  <button
                    key={place.id}
                    type="button"
                    className={classes.join(" ")}
                    disabled={place.etat !== "libre" || enCours}
                    aria-pressed={choisie}
                    aria-label={descriptionPlace(place)}
                    title={libellePlace(place)}
                    onClick={() => basculer(place.id)}
                  >
                    {place.numero}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        <ul className="legende">
          <li>
            <span className="siege libre" /> Libre
          </li>
          <li>
            <span className="siege libre choisie" /> Votre choix
          </li>
          <li>
            <span className="siege verrouillee" /> En cours de réservation
          </li>
          <li>
            <span className="siege vendue" /> Vendue
          </li>
          <li>
            <span className="siege libre pmr" /> Accessible PMR
          </li>
        </ul>
      </section>

      <section className="carte">
        <h2>Votre réservation</h2>
        <form action={action} className="formulaire">
          <input type="hidden" name="seanceId" value={seanceId} />
          {selection.map((id) => (
            <input key={id} type="hidden" name="placeIds" value={id} />
          ))}
          <p>
            {selection.length === 0
              ? "Aucune place choisie."
              : `${selection.length} place(s) : ${libelles(selection)} — ${formaterPrix(selection.length * prixCentimes)}`}
          </p>
          <p className="discret">Jusqu’à {MAX_PLACES_PAR_RESERVATION} places par réservation.</p>
          {emailConnecte ? (
            <p>
              Réservation rattachée à votre compte : <strong>{emailConnecte}</strong>
            </p>
          ) : (
            <>
              <label htmlFor="email">Adresse e-mail (pour recevoir vos billets)</label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <label htmlFor="nomClient">Nom (facultatif)</label>
              <input
                id="nomClient"
                name="nomClient"
                autoComplete="name"
                maxLength={100}
                value={nomClient}
                onChange={(e) => setNomClient(e.target.value)}
              />
            </>
          )}
          {etat.message ? (
            <p role="alert" className="erreur">
              {etat.message}
            </p>
          ) : null}
          <button type="submit" disabled={selection.length === 0 || enCours}>
            {enCours ? "Blocage en cours…" : "Bloquer mes places pendant 10 minutes"}
          </button>
        </form>
      </section>
    </div>
  );
}

/** Temps restant avant la libération automatique des places. */
function CompteARebours({ expireAt }: { expireAt: string }) {
  const [restantMs, setRestantMs] = useState<number | null>(null);

  useEffect(() => {
    const fin = new Date(expireAt).getTime();
    const mettreAJour = () => setRestantMs(Math.max(0, fin - Date.now()));
    const premier = setTimeout(mettreAJour, 0);
    const minuterie = setInterval(mettreAJour, 1000);
    return () => {
      clearTimeout(premier);
      clearInterval(minuterie);
    };
  }, [expireAt]);

  if (restantMs === null) return null;
  if (restantMs === 0) {
    return (
      <p role="alert" className="erreur">
        Délai dépassé : les places ont été libérées.
      </p>
    );
  }
  const minutes = Math.floor(restantMs / 60_000);
  const secondes = Math.floor((restantMs % 60_000) / 1000);
  return (
    <p className="compte-a-rebours">
      Temps restant : {minutes}:{String(secondes).padStart(2, "0")}
    </p>
  );
}
