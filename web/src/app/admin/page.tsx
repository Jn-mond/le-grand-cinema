import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { formaterDateHeure, formaterPrix } from "@/lib/dates";
import { utilisateurConnecte } from "@/lib/session";
import { clientSupabaseServeur } from "@/lib/supabase-serveur";
import {
  listerChoixProgrammation,
  listerSeancesAVenir,
} from "@/modules/seances/catalogue-supabase";
import { peutProgrammer } from "@/modules/utilisateurs/roles";
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
  return (
    <div className="colonnes">
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
                <th>Film</th>
                <th>Salle</th>
                <th>Prix</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {seances.map((seance) => (
                <tr key={seance.id}>
                  <td>{formaterDateHeure(seance.debutAt)}</td>
                  <td>
                    {seance.film} ({seance.version.toUpperCase()})
                  </td>
                  <td>{seance.salle}</td>
                  <td>{formaterPrix(seance.prixCentimes)}</td>
                  <td>{seance.statut}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
