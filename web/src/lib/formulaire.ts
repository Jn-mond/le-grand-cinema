import type { ErreurApplication } from "./erreurs";

/**
 * Valeurs saisies dans un formulaire, renvoyées au navigateur quand le serveur refuse l'envoi.
 *
 * Après chaque action, React remet le formulaire à ses valeurs par défaut, même si le serveur a
 * refusé la saisie. Le formulaire reprend donc ces valeurs comme valeurs par défaut : la personne
 * retrouve ce qu'elle a tapé à côté du message d'erreur, au lieu d'un formulaire vidé.
 */
export type ValeursSaisies = Record<string, string | string[]>;

/**
 * Lit les champs attendus d'un formulaire, et seulement eux (les champs techniques ajoutés par
 * Next.js sont ignorés). Un champ simple absent, comme une case décochée, vaut "" ; un champ
 * multiple (cases à cocher de même nom) donne la liste de ses valeurs.
 */
export function valeursSaisies(
  donnees: FormData,
  champs: readonly string[],
  multiples: readonly string[] = [],
): ValeursSaisies {
  const valeurs: ValeursSaisies = {};
  for (const champ of champs) {
    const valeur = donnees.get(champ);
    valeurs[champ] = typeof valeur === "string" ? valeur : "";
  }
  for (const champ of multiples) {
    valeurs[champ] = donnees.getAll(champ).filter((v): v is string => typeof v === "string");
  }
  return valeurs;
}

/** Valeur d'un champ simple : la saisie refusée si elle existe, sinon la valeur par défaut. */
export function valeurInitiale(
  saisie: ValeursSaisies | undefined,
  champ: string,
  parDefaut: string,
): string {
  const valeur = saisie?.[champ];
  return typeof valeur === "string" ? valeur : parDefaut;
}

/** Message à afficher pour une saisie refusée : le premier problème, sinon un message général. */
export function messageSaisie(erreur: ErreurApplication): string {
  const erreurs = erreur.details?.erreurs;
  if (erreur.code === "REQUETE_INVALIDE" && Array.isArray(erreurs) && erreurs.length > 0) {
    const premier = erreurs[0] as { message?: unknown };
    if (typeof premier.message === "string") return premier.message;
  }
  return erreur.message;
}
