import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { formaterDateHeure, formaterPrix } from "@/lib/dates";
import { clientSupabaseServeur } from "@/lib/supabase-serveur";
import { lireReservationPayee, type ReservationPayee } from "@/modules/paiements/depot-supabase";
import { etatPaiement } from "@/modules/paiements/suivi";
import { libellePlace } from "@/modules/seances/plan";
import { BoutonPayer } from "../bouton-payer";
import { Actualisation } from "./actualisation";

export const metadata: Metadata = { title: "Paiement — Le Grand Cinéma" };

/** E4 — page de retour du paiement : confirmé, en cours, abandonné ou refusé. */
export default function PageReservation({ params, searchParams }: PageProps<"/reservations/[id]">) {
  return (
    <>
      <p>
        <Link href="/" className="discret">
          ← Retour au programme
        </Link>
      </p>
      <Suspense fallback={<p className="discret">Chargement…</p>}>
        <SuiviPaiement params={params} searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function SuiviPaiement({ params, searchParams }: PageProps<"/reservations/[id]">) {
  await connection(); // l'état change à chaque instant : jamais mis en cache
  const { id } = await params;
  const { paiement } = await searchParams;
  const reservation = await lireReservationPayee(clientSupabaseServeur(), id);
  if (!reservation) notFound();
  const etat = etatPaiement({
    statutReservation: reservation.statut,
    derniereCommande: reservation.derniereCommande,
    bloqueeJusqua: reservation.bloqueeJusqua,
    retour: typeof paiement === "string" ? paiement : undefined,
  });

  return (
    <section className="carte recapitulatif" aria-live="polite">
      <h1>{TITRES[etat]}</h1>
      <Resume reservation={reservation} />
      {etat === "confirmee" ? <Billets reservation={reservation} /> : null}
      {etat === "en_cours" ? <Actualisation /> : null}
      {etat === "non_abouti" ? (
        <p>
          Vos places n’étaient plus disponibles au moment du paiement (délai de 10 minutes dépassé,
          places reprises par un autre client). L’autorisation a été annulée :{" "}
          <strong>votre carte n’est pas débitée</strong>.
        </p>
      ) : null}
      {etat === "abandon" || etat === "a_payer" ? (
        <>
          {etat === "abandon" ? <p>Rien n’a été débité.</p> : null}
          <p>
            Vos places restent bloquées jusqu’à{" "}
            {formaterDateHeure(reservation.bloqueeJusqua as Date)}.
          </p>
          <BoutonPayer reservationId={id} montantCentimes={reservation.montantCentimes ?? 0} />
        </>
      ) : null}
      {etat === "expiree" ? (
        <p>
          Le délai de 10 minutes est dépassé : les places ont été libérées. Rien n’a été débité.
        </p>
      ) : null}
    </section>
  );
}

const TITRES = {
  confirmee: "Paiement confirmé",
  en_cours: "Paiement reçu",
  non_abouti: "Paiement non abouti",
  abandon: "Paiement abandonné",
  a_payer: "Paiement à effectuer",
  expiree: "Réservation expirée",
} as const;

function Resume({ reservation }: { reservation: ReservationPayee }) {
  return (
    <>
      <p>
        Référence : <strong>{reservation.reference}</strong>
      </p>
      <p>
        {reservation.titreFilm} — {formaterDateHeure(reservation.debutSeance)} — {reservation.salle}
      </p>
    </>
  );
}

function Billets({ reservation }: { reservation: ReservationPayee }) {
  const total = reservation.billets.reduce((somme, billet) => somme + billet.prixCentimes, 0);
  return (
    <>
      <p>Places : {reservation.billets.map(libellePlace).join(", ")}</p>
      <p>Total payé : {formaterPrix(total)}</p>
    </>
  );
}
