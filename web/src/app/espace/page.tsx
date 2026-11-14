import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { formaterDateHeure } from "@/lib/dates";
import { utilisateurConnecte } from "@/lib/session";
import { clientSupabaseServeur } from "@/lib/supabase-serveur";
import { listerReservationsDe } from "@/modules/reservations/mes-reservations-supabase";
import { libelleRole } from "@/modules/utilisateurs/roles";

export const metadata: Metadata = { title: "Mon espace — Le Grand Cinéma" };

export default function PageEspace() {
  return (
    <>
      <h1>Mon espace</h1>
      <Suspense fallback={<p className="discret">Chargement…</p>}>
        <MesReservations />
      </Suspense>
    </>
  );
}

async function MesReservations() {
  const utilisateur = await utilisateurConnecte();
  if (!utilisateur) redirect("/connexion");
  const reservations = await listerReservationsDe(clientSupabaseServeur(), utilisateur.id);
  return (
    <section className="carte">
      <p>
        {utilisateur.prenom} {utilisateur.nom} · {utilisateur.email} ·{" "}
        {libelleRole(utilisateur.role)}
      </p>
      <h2>Mes réservations</h2>
      {reservations.length === 0 ? (
        <p className="discret">Aucune réservation pour l’instant.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Référence</th>
              <th>Film</th>
              <th>Séance</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            {reservations.map((reservation) => (
              <tr key={reservation.reference}>
                <td>{reservation.reference}</td>
                <td>{reservation.film}</td>
                <td>
                  {reservation.debutSeance ? formaterDateHeure(reservation.debutSeance) : "—"}
                </td>
                <td>{reservation.statut}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
