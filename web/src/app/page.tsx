import { connection } from "next/server";
import { Suspense } from "react";
import { formaterDateHeure, formaterPrix } from "@/lib/dates";
import { clientSupabaseServeur } from "@/lib/supabase-serveur";
import { listerSeancesAVenir } from "@/modules/seances/catalogue-supabase";

export default function Accueil() {
  return (
    <>
      <section className="bandeau">
        <h1>Programme</h1>
        <p>Toutes les séances à venir du Grand Cinéma.</p>
      </section>
      <Suspense fallback={<p className="discret">Chargement du programme…</p>}>
        <Programme />
      </Suspense>
    </>
  );
}

/** E1 — programme public : séances publiées et à venir, à l'heure de Paris. */
async function Programme() {
  await connection(); // le programme dépend de l'heure actuelle : calculé à chaque requête
  const seances = await listerSeancesAVenir(clientSupabaseServeur(), { publieesSeulement: true });
  if (seances.length === 0) {
    return <p className="discret">Aucune séance programmée pour le moment.</p>;
  }
  return (
    <ul className="liste-seances">
      {seances.map((seance) => (
        <li key={seance.id} className="carte">
          <p className="titre-film">{seance.film}</p>
          <p>{formaterDateHeure(seance.debutAt)}</p>
          <p className="discret">
            {seance.salle} · {seance.version.toUpperCase()} · {seance.dureeMinutes} min ·{" "}
            {formaterPrix(seance.prixCentimes)}
          </p>
        </li>
      ))}
    </ul>
  );
}
