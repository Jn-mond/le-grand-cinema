import type { Metadata } from "next";
import { FormulaireConnexion } from "./formulaire-connexion";

export const metadata: Metadata = { title: "Connexion — Le Grand Cinéma" };

export default function PageConnexion() {
  return (
    <section className="carte etroite">
      <h1>Connexion</h1>
      <p className="discret">Accédez à vos réservations ou, pour le personnel, à la programmation.</p>
      <FormulaireConnexion />
    </section>
  );
}
