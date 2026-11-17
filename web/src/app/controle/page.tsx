import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { utilisateurConnecte } from "@/lib/session";
import { peutControlerBillets } from "@/modules/utilisateurs/roles";
import { PosteControle } from "./poste-controle";

export const metadata: Metadata = { title: "Contrôle des billets — Le Grand Cinéma" };

/** E5 — contrôle des billets à l'entrée des salles, pour l'accueil et la programmation. */
export default function PageControle() {
  return (
    <>
      <h1>Contrôle des billets</h1>
      <Suspense fallback={<p className="discret">Chargement…</p>}>
        <Controle />
      </Suspense>
    </>
  );
}

async function Controle() {
  await connection(); // dépend de la session : calculé à chaque requête
  const utilisateur = await utilisateurConnecte();
  if (!utilisateur) redirect("/connexion");
  if (!peutControlerBillets(utilisateur.role)) {
    return (
      <p role="alert" className="erreur">
        Accès réservé au personnel du cinéma.
      </p>
    );
  }
  return (
    <section className="carte etroite">
      <PosteControle />
      <p className="discret">
        Un billet est accepté une seule fois, de 60 minutes avant le début de sa séance jusqu’à la
        fin de celle-ci.
      </p>
    </section>
  );
}
