import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { utilisateurConnecte } from "@/lib/session";
import { clientSupabaseServeur } from "@/lib/supabase-serveur";
import { schemaIdentifiantFilm } from "@/modules/films/fiche";
import { lireFilmEditable, listerGenres } from "@/modules/films/gestion-supabase";
import { peutProgrammer } from "@/modules/utilisateurs/roles";
import { FormulaireFilm } from "../formulaire-film";

export const metadata: Metadata = { title: "Modifier un film — Le Grand Cinéma" };

export default function PageModifierFilm({ params }: PageProps<"/admin/films/[id]">) {
  return (
    <>
      <p>
        <Link href="/admin/films" className="discret">
          ← Films
        </Link>
      </p>
      <Suspense fallback={<p className="discret">Chargement du film…</p>}>
        <ModifierFilm params={params} />
      </Suspense>
    </>
  );
}

/** E7 — modifier un film : fiche, genres, activation. */
async function ModifierFilm({ params }: { params: Promise<{ id: string }> }) {
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
  const { id } = await params;
  const identifiant = schemaIdentifiantFilm.safeParse(id);
  if (!identifiant.success) notFound();

  const client = clientSupabaseServeur();
  const [film, genres] = await Promise.all([
    lireFilmEditable(client, identifiant.data),
    listerGenres(client),
  ]);
  if (!film) notFound();

  return (
    <section className="carte etroite-large">
      <h1>{film.titre}</h1>
      <p className="discret">
        La durée ne peut plus changer si des séances à venir sont programmées : leur heure de fin en
        dépend.
      </p>
      <FormulaireFilm key={film.id} genres={genres} film={film} />
    </section>
  );
}
