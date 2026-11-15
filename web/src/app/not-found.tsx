import Link from "next/link";

/** Page introuvable : film retiré, séance non publiée ou passée, adresse mal saisie. */
export default function PageIntrouvable() {
  return (
    <section className="carte etroite">
      <h1>Page introuvable</h1>
      <p>
        Cette page n’existe pas ou n’est plus disponible : film retiré du catalogue, séance qui
        n’est plus programmée ou adresse mal saisie.
      </p>
      <p>
        <Link href="/" className="bouton">
          Retour au programme
        </Link>
      </p>
    </section>
  );
}
