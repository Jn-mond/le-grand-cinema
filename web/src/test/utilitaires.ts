/** Exécute une fonction et renvoie l'erreur levée ; échoue si aucune erreur n'est levée. */
export function erreurLevee(action: () => unknown): unknown {
  try {
    action();
  } catch (erreur) {
    return erreur;
  }
  throw new Error("Une erreur était attendue mais aucune n'a été levée");
}
