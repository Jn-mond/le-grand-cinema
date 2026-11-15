import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { formaterDateHeure, formaterJourHeure } from "@/lib/dates";
import { utilisateurConnecte } from "@/lib/session";
import { clientSupabaseServeur } from "@/lib/supabase-serveur";
import { schemaIdentifiantSeance } from "@/modules/reservations/schemas";
import { libelleCanal } from "@/modules/reservations/suivi";
import { lireSuiviSeance } from "@/modules/reservations/suivi-supabase";
import { lireSeance } from "@/modules/seances/catalogue-supabase";
import { DepotSeancesSupabase } from "@/modules/seances/depot-supabase";
import { libellePlace, libelleStatut } from "@/modules/seances/plan";
import { obtenirPlanDeSalle } from "@/modules/seances/service";
import { peutConsulterReservations } from "@/modules/utilisateurs/roles";

export const metadata: Metadata = { title: "Réservations d’une séance — Le Grand Cinéma" };

export default function PageReservationsSeance({ params }: PageProps<"/admin/seances/[id]">) {
  return (
    <>
      <p>
        <Link href="/admin" className="discret">
          ← Retour à la programmation
        </Link>
      </p>
      <Suspense fallback={<p className="discret">Chargement des réservations…</p>}>
        <ReservationsSeance params={params} />
      </Suspense>
    </>
  );
}

/** E8 — réservations d'une séance, pour le personnel d'accueil et de programmation. */
async function ReservationsSeance({ params }: { params: Promise<{ id: string }> }) {
  await connection(); // dépend de la session et de l'heure : calculé à chaque requête
  const utilisateur = await utilisateurConnecte();
  if (!utilisateur) redirect("/connexion");
  if (!peutConsulterReservations(utilisateur.role)) {
    return (
      <p role="alert" className="erreur">
        Accès réservé au personnel du cinéma.
      </p>
    );
  }
  const { id } = await params;
  const identifiant = schemaIdentifiantSeance.safeParse(id);
  if (!identifiant.success) notFound();

  const client = clientSupabaseServeur();
  const seance = await lireSeance(client, identifiant.data, { publieeSeulement: false });
  if (!seance) notFound();
  const plan = await obtenirPlanDeSalle(new DepotSeancesSupabase(client), seance.id);
  const libelles = new Map(plan.places.map((place) => [place.id, libellePlace(place)]));
  const reservations = await lireSuiviSeance(client, seance.id, libelles);

  return (
    <>
      <section className="bandeau">
        <h1>Réservations</h1>
        <p>
          {seance.film} ({seance.version.toUpperCase()}) · {formaterDateHeure(seance.debutAt)}
        </p>
        <p className="discret">
          {seance.salle} · {libelleStatut(seance.statut)} · {plan.resume.vendue} vendue(s),{" "}
          {plan.resume.verrouillee} en cours de réservation, {plan.resume.libre} libre(s)
        </p>
      </section>
      <section className="carte">
        {reservations.length === 0 ? (
          <p className="discret">Aucune réservation pour cette séance.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Référence</th>
                <th>Client</th>
                <th>Places</th>
                <th>Canal</th>
                <th>Statut</th>
                <th>Créée le</th>
              </tr>
            </thead>
            <tbody>
              {reservations.map((reservation) => (
                <tr key={reservation.reference}>
                  <td>{reservation.reference}</td>
                  <td>
                    {reservation.nomClient ?? "—"}
                    <span className="sous-ligne">{reservation.email}</span>
                  </td>
                  <td>{reservation.places.length > 0 ? reservation.places.join(", ") : "—"}</td>
                  <td>{libelleCanal(reservation.canal)}</td>
                  <td>{libelleStatut(reservation.statut)}</td>
                  <td>{formaterJourHeure(reservation.creeAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
