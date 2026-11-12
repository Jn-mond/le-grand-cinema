import { ErreurApplication } from "./erreurs";

const TYPE_PROBLEME = "application/problem+json";

/** Réponse JSON de succès. */
export function reponseJson(donnees: unknown, statut = 200): Response {
  return Response.json(donnees, { status: statut });
}

/**
 * Transforme une erreur en réponse au format « problem details » (RFC 9457).
 * Une erreur inattendue est journalisée côté serveur mais son détail n'est jamais
 * renvoyé au client (il pourrait révéler la structure interne).
 */
export function reponseErreur(erreur: unknown): Response {
  if (erreur instanceof ErreurApplication) {
    return Response.json(
      {
        type: "about:blank",
        title: erreur.message,
        status: erreur.statut,
        code: erreur.code,
        ...erreur.details,
      },
      { status: erreur.statut, headers: { "Content-Type": TYPE_PROBLEME } },
    );
  }
  console.error("Erreur inattendue", erreur);
  return Response.json(
    {
      type: "about:blank",
      title: "Erreur interne du serveur",
      status: 500,
      code: "ERREUR_INTERNE",
    },
    { status: 500, headers: { "Content-Type": TYPE_PROBLEME } },
  );
}

/** Exécute le traitement d'une route et convertit toute erreur en réponse HTTP. */
export async function traiterRequete(traitement: () => Promise<Response>): Promise<Response> {
  try {
    return await traitement();
  } catch (erreur) {
    return reponseErreur(erreur);
  }
}

/** Lit le corps JSON d'une requête ; un corps absent ou mal formé est une requête invalide. */
export async function lireCorpsJson(requete: Request): Promise<unknown> {
  try {
    return await requete.json();
  } catch {
    throw new ErreurApplication("REQUETE_INVALIDE", "Le corps de la requête doit être un JSON valide");
  }
}
