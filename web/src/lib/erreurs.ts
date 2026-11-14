/**
 * Erreurs attendues de l'application. Chaque code correspond à un statut HTTP :
 * les routes n'ont pas à connaître ces correspondances.
 */
export type CodeErreur =
  | "REQUETE_INVALIDE"
  | "SEANCE_INTROUVABLE"
  | "SEANCE_NON_RESERVABLE"
  | "RESERVATION_INTROUVABLE"
  | "RESERVATION_NON_MODIFIABLE"
  | "RESERVATION_EXPIREE"
  | "PLACES_INDISPONIBLES"
  | "PLACES_TROP_NOMBREUSES"
  | "CONFIGURATION_MANQUANTE"
  | "FILM_INTROUVABLE"
  | "SALLE_INTROUVABLE"
  | "SEANCE_DANS_LE_PASSE"
  | "SEANCE_EN_CONFLIT";

const STATUT_HTTP: Record<CodeErreur, number> = {
  REQUETE_INVALIDE: 400,
  SEANCE_INTROUVABLE: 404,
  SEANCE_NON_RESERVABLE: 422,
  RESERVATION_INTROUVABLE: 404,
  RESERVATION_NON_MODIFIABLE: 409,
  RESERVATION_EXPIREE: 410,
  PLACES_INDISPONIBLES: 409,
  PLACES_TROP_NOMBREUSES: 422,
  CONFIGURATION_MANQUANTE: 500,
  FILM_INTROUVABLE: 404,
  SALLE_INTROUVABLE: 404,
  SEANCE_DANS_LE_PASSE: 422,
  SEANCE_EN_CONFLIT: 409,
};

export class ErreurApplication extends Error {
  readonly code: CodeErreur;
  readonly details?: Record<string, unknown>;

  constructor(code: CodeErreur, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "ErreurApplication";
    this.code = code;
    this.details = details;
  }

  get statut(): number {
    return STATUT_HTTP[this.code];
  }
}
