import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { formaterDateHeure, formaterPrix } from "@/lib/dates";
import { utilisateurConnecte } from "@/lib/session";
import { clientSupabaseServeur } from "@/lib/supabase-serveur";
import { schemaIdentifiantSeance } from "@/modules/reservations/schemas";
import { lireSeancePubliee } from "@/modules/seances/catalogue-supabase";
import { DepotSeancesSupabase } from "@/modules/seances/depot-supabase";
import { reservationEnLigneOuverte } from "@/modules/seances/plan";
import { obtenirPlanDeSalle } from "@/modules/seances/service";
import { PlanDeSalle } from "./plan-de-salle";

export const metadata: Metadata = { title: "Réserver — Le Grand Cinéma" };

export default function PageSeance({ params }: PageProps<"/seances/[id]">) {
  return (
    <>
      <p>
        <Link href="/" className="discret">
          ← Retour au programme
        </Link>
      </p>
      <Suspense fallback={<p className="discret">Chargement du plan de salle…</p>}>
        <Reservation params={params} />
      </Suspense>
    </>
  );
}

/** E2 / E3 — plan de salle d'une séance publiée et blocage des places choisies. */
async function Reservation({ params }: { params: Promise<{ id: string }> }) {
  await connection(); // l'état des places change à chaque instant : calculé à chaque requête
  const { id } = await params;
  const identifiant = schemaIdentifiantSeance.safeParse(id);
  if (!identifiant.success) notFound();

  const client = clientSupabaseServeur();
  const seance = await lireSeancePubliee(client, identifiant.data);
  if (!seance) notFound();

  if (!reservationEnLigneOuverte(seance.debutAt)) {
    return (
      <section className="carte">
        <h1>{seance.film}</h1>
        <p role="alert" className="erreur">
          Cette séance a déjà commencé : la réservation en ligne est fermée.
        </p>
      </section>
    );
  }

  const [plan, utilisateur] = await Promise.all([
    obtenirPlanDeSalle(new DepotSeancesSupabase(client), seance.id),
    utilisateurConnecte(),
  ]);

  return (
    <>
      <section className="bandeau">
        <h1>{seance.film}</h1>
        <p>{formaterDateHeure(seance.debutAt)}</p>
        <p className="discret">
          {seance.salle} · {seance.version.toUpperCase()} · {seance.dureeMinutes} min ·{" "}
          {formaterPrix(seance.prixCentimes)} la place · {plan.resume.libre} place(s) libre(s)
        </p>
      </section>
      <PlanDeSalle
        seanceId={seance.id}
        places={plan.places}
        prixCentimes={seance.prixCentimes}
        emailConnecte={utilisateur?.email ?? null}
      />
    </>
  );
}
