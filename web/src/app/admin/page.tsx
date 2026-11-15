import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { formaterDateHeure, formaterPrix } from "@/lib/dates";
import { utilisateurConnecte } from "@/lib/session";
import { clientSupabaseServeur } from "@/lib/supabase-serveur";
import {
  detailRemplissage,
  libelleTaux,
  type Remplissage as RemplissageSeance,
} from "@/modules/pilotage/remplissage";
import { lireRemplissages } from "@/modules/pilotage/remplissage-supabase";
import { libelleReservations } from "@/modules/pilotage/reservations";
import { lireReservationsParSeance } from "@/modules/pilotage/reservations-supabase";
import {
  listerChoixProgrammation,
  listerSeancesAVenir,
} from "@/modules/seances/catalogue-supabase";
import { libelleStatut } from "@/modules/seances/plan";
import { peutProgrammer } from "@/modules/utilisateurs/roles";
import { BoutonPublication } from "./bouton-publication";
import { FormulaireSeance } from "./formulaire-seance";

export const metadata: Metadata = { title: "Programmation — Le Grand Cinéma" };

export default function PageAdmin() {
  return (
    <>
      <h1>Programmation</h1>
      <Suspense fallback={<p className="discret">Chargement…</p>}>
        <Programmation />
      </Suspense>
    </>
  );
}

async function Programmation() {
  await connection(); // dépend de la session et de l'heure : calculé à chaque requête
  const utilisateur = await utilisateurConnecte();
  if (!utilisateur) redirect("/connexion");
  if (!peutProgrammer(utilisateur.role)) {
    return (
      <p role="alert" className="erreur">
        Accès réservé au personnel de programmation.
      </p>
    );
  }
  const client = clientSupabaseServeur();
  const [choix, seances] = await Promise.all([
    listerChoixProgrammation(client),
    listerSeancesAVenir(client, { publieesSeulement: false }),
  ]);
  const ids = seances.map((seance) => seance.id);
  const [remplissages, reservations] = await Promise.all([
    lireRemplissages(client, ids),
    lireReservationsParSeance(client, ids),
  ]);
  return (
    <div className="colonnes programmation">
      <section className="carte">
        <h2>Nouvelle séance</h2>
        <FormulaireSeance films={choix.films} salles={choix.salles} />
      </section>
      <section className="carte">
        <h2>Séances à venir ({seances.length})</h2>
        {seances.length === 0 ? (
          <p className="discret">Aucune séance à venir.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Séance</th>
                <th>Statut</th>
                <th>Remplissage</th>
                <th>Réservations</th>
                <th>Site</th>
              </tr>
            </thead>
            <tbody>
              {seances.map((seance) => (
                <tr key={seance.id}>
                  <td>{formaterDateHeure(seance.debutAt)}</td>
                  <td>
                    {seance.film} ({seance.version.toUpperCase()})
                    <span className="sous-ligne">
                      {seance.salle} · {formaterPrix(seance.prixCentimes)}
                    </span>
                  </td>
                  <td>{libelleStatut(seance.statut)}</td>
                  <td>
                    <CelluleRemplissage remplissage={remplissages.get(seance.id)} />
                  </td>
                  <td>
                    <Link href={`/admin/seances/${seance.id}`}>
                      {libelleReservations(
                        reservations.get(seance.id) ?? { confirmees: 0, enCours: 0 },
                      )}
                    </Link>
                  </td>
                  <td>
                    <BoutonPublication seanceId={seance.id} statut={seance.statut} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

/** E9 — taux de remplissage d'une séance, avec une jauge et le détail des places. */
function CelluleRemplissage({ remplissage }: { remplissage: RemplissageSeance | undefined }) {
  if (!remplissage) return <span className="discret">—</span>;
  return (
    <>
      <strong>{libelleTaux(remplissage)}</strong>
      {remplissage.tauxPct !== null ? (
        <meter
          className="jauge"
          min={0}
          max={100}
          value={remplissage.tauxPct}
          aria-label={`Taux de remplissage : ${libelleTaux(remplissage)}`}
        />
      ) : null}
      <span className="sous-ligne">{detailRemplissage(remplissage)}</span>
    </>
  );
}
