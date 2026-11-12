import { ErreurApplication } from "../../lib/erreurs";

/** Durée pendant laquelle les places choisies restent bloquées (règle E3, identique à la base). */
export const DUREE_VERROU_MINUTES = 10;

/** Nombre maximal de places par réservation (hypothèse à valider avec le cinéma). */
export const MAX_PLACES_PAR_RESERVATION = 10;

/** Échéance du verrou : le délai court depuis la création de la réservation (correctif C1). */
export function echeanceReservation(creeAt: Date): Date {
  return new Date(creeAt.getTime() + DUREE_VERROU_MINUTES * 60_000);
}

export function estExpiree(creeAt: Date, maintenant: Date): boolean {
  return maintenant.getTime() >= echeanceReservation(creeAt).getTime();
}

/** Supprime les doublons, trie les places et vérifie leur nombre. */
export function normaliserPlaces(placeIds: readonly number[]): number[] {
  const places = [...new Set(placeIds)].sort((a, b) => a - b);
  if (places.length === 0) {
    throw new ErreurApplication("REQUETE_INVALIDE", "Au moins une place doit être choisie");
  }
  if (places.length > MAX_PLACES_PAR_RESERVATION) {
    throw new ErreurApplication(
      "PLACES_TROP_NOMBREUSES",
      `Une réservation est limitée à ${MAX_PLACES_PAR_RESERVATION} places`,
      { maximum: MAX_PLACES_PAR_RESERVATION },
    );
  }
  return places;
}
