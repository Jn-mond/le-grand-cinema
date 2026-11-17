import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { utilisateurConnecte } from "@/lib/session";
import { clientSupabaseServeur } from "@/lib/supabase-serveur";
import { formaterDateSortie, formaterDuree, libelleAge } from "@/modules/films/fiche";
import { listerFilmsGeres, listerGenres } from "@/modules/films/gestion-supabase";
import { peutProgrammer } from "@/modules/utilisateurs/roles";
import { FormulaireFilm } from "./formulaire-film";

export const metadata: Metadata = { title: "Films — Le Grand Cinéma" };

export default function PageFilms() {
  return (
    <>
      <p>
        <Link href="/admin" className="discret">
          ← Programmation
        </Link>
      </p>
      <h1>Films</h1>
      <Suspense fallback={<p className="discret">Chargement des films…</p>}>
        <GestionFilms />
      </Suspense>
    </>
  );
}

/** E7 — liste des films (actifs ou non) et création d'un film. */
async function GestionFilms() {
  await connection(); // dépend de la session : calculé à chaque requête
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
  const [films, genres] = await Promise.all([listerFilmsGeres(client), listerGenres(client)]);
  return (
    <div className="colonnes programmation">
      <section className="carte">
        <h2>Nouveau film</h2>
        <FormulaireFilm genres={genres} />
      </section>
      <section className="carte">
        <h2>Catalogue ({films.length})</h2>
        {films.length === 0 ? (
          <p className="discret">Aucun film pour le moment.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Titre</th>
                <th>Durée</th>
                <th>Public</th>
                <th>Sortie</th>
                <th>État</th>
              </tr>
            </thead>
            <tbody>
              {films.map((film) => (
                <tr key={film.id}>
                  <td>
                    <Link href={`/admin/films/${film.id}`}>{film.titre}</Link>
                    {film.genres.length > 0 ? (
                      <span className="sous-ligne">{film.genres.join(", ")}</span>
                    ) : null}
                  </td>
                  <td>{formaterDuree(film.dureeMinutes)}</td>
                  <td>{libelleAge(film.ageMinimum)}</td>
                  <td>{formaterDateSortie(film.dateSortie) ?? "—"}</td>
                  <td>{film.actif ? "Actif" : "Inactif"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
