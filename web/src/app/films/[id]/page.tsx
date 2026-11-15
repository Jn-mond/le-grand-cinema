import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { formaterDateHeure, formaterPrix } from "@/lib/dates";
import { clientSupabaseServeur } from "@/lib/supabase-serveur";
import {
  afficheSure,
  formaterDateSortie,
  formaterDuree,
  libelleAge,
  schemaIdentifiantFilm,
} from "@/modules/films/fiche";
import { lireFicheFilm } from "@/modules/films/fiche-supabase";
import { listerSeancesAVenir } from "@/modules/seances/catalogue-supabase";

export const metadata: Metadata = { title: "Fiche du film — Le Grand Cinéma" };

export default function PageFilm({ params }: PageProps<"/films/[id]">) {
  return (
    <>
      <p>
        <Link href="/" className="discret">
          ← Retour au programme
        </Link>
      </p>
      <Suspense fallback={<p className="discret">Chargement de la fiche…</p>}>
        <FicheFilm params={params} />
      </Suspense>
    </>
  );
}

/** E1 — fiche d'un film : affiche, durée, public, genres, synopsis et prochaines séances. */
async function FicheFilm({ params }: { params: Promise<{ id: string }> }) {
  await connection(); // les prochaines séances dépendent de l'heure : calculé à chaque requête
  const { id } = await params;
  const identifiant = schemaIdentifiantFilm.safeParse(id);
  if (!identifiant.success) notFound();

  const client = clientSupabaseServeur();
  const [film, seances] = await Promise.all([
    lireFicheFilm(client, identifiant.data),
    listerSeancesAVenir(client, { publieesSeulement: true, filmId: identifiant.data }),
  ]);
  if (!film) notFound();

  const affiche = afficheSure(film.afficheUrl);
  const sortie = formaterDateSortie(film.dateSortie);
  const details = [formaterDuree(film.dureeMinutes), libelleAge(film.ageMinimum), ...film.genres];

  return (
    <article className="fiche-film">
      <div className="affiche">
        {affiche ? (
          // Affiche hébergée chez un tiers choisi par le cinéma : pas d'optimisation Next.js,
          // qui exigerait de déclarer chaque domaine ; dimensions fixées pour éviter tout décalage.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={affiche} alt={`Affiche du film ${film.titre}`} width={240} height={360} />
        ) : (
          <p className="affiche-absente">Affiche à venir</p>
        )}
      </div>
      <div>
        <h1>{film.titre}</h1>
        {film.titreOriginal && film.titreOriginal !== film.titre ? (
          <p className="discret">Titre original : {film.titreOriginal}</p>
        ) : null}
        <p>{details.join(" · ")}</p>
        {sortie ? <p className="discret">Sortie le {sortie}</p> : null}
        <h2>Synopsis</h2>
        <p>{film.synopsis ?? "Synopsis à venir."}</p>

        <h2>Prochaines séances</h2>
        {seances.length === 0 ? (
          <p className="discret">Aucune séance programmée pour ce film pour le moment.</p>
        ) : (
          <ul className="seances-du-film">
            {seances.map((seance) => (
              <li key={seance.id}>
                <span>
                  {formaterDateHeure(seance.debutAt)}
                  <span className="sous-ligne">
                    {seance.salle} · {seance.version.toUpperCase()} ·{" "}
                    {formaterPrix(seance.prixCentimes)}
                  </span>
                </span>
                <Link href={`/seances/${seance.id}`} className="bouton">
                  Réserver
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </article>
  );
}
