import Link from "next/link";
import { connection } from "next/server";
import { utilisateurConnecte } from "@/lib/session";
import { peutProgrammer } from "@/modules/utilisateurs/roles";
import { seDeconnecter } from "./connexion/actions";

/** Liens d'en-tête selon la personne connectée (lus à chaque requête, derrière un Suspense). */
export async function EtatConnexion() {
  await connection(); // la vérification de session dépend de l'heure (expiration du jeton)
  const utilisateur = await utilisateurConnecte();
  if (!utilisateur) {
    return <Link href="/connexion">Se connecter</Link>;
  }
  return (
    <>
      {peutProgrammer(utilisateur.role) ? <Link href="/admin">Programmation</Link> : null}
      <Link href="/espace">Mon espace</Link>
      <form action={seDeconnecter}>
        <button type="submit" className="lien">
          Se déconnecter ({utilisateur.prenom})
        </button>
      </form>
    </>
  );
}
