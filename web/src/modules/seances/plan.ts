import type { EtatPlace, PlaceDeSeance } from "./depot";

export interface RangeeDuPlan {
  rangee: string;
  places: PlaceDeSeance[];
}

/** Regroupe les places par rangée (A, B, …) et les trie par numéro, pour dessiner le plan. */
export function organiserPlan(places: readonly PlaceDeSeance[]): RangeeDuPlan[] {
  const parRangee = new Map<string, PlaceDeSeance[]>();
  for (const place of places) {
    const liste = parRangee.get(place.rangee) ?? [];
    liste.push(place);
    parRangee.set(place.rangee, liste);
  }
  return [...parRangee.entries()]
    .sort(([a], [b]) => a.length - b.length || a.localeCompare(b))
    .map(([rangee, liste]) => ({
      rangee,
      places: [...liste].sort((a, b) => a.numero - b.numero),
    }));
}

/** Exemple : rangée A, numéro 3 → « A3 ». */
export function libellePlace(place: Pick<PlaceDeSeance, "rangee" | "numero">): string {
  return `${place.rangee}${place.numero}`;
}

const LIBELLES_ETAT: Record<EtatPlace, string> = {
  libre: "libre",
  verrouillee: "en cours de réservation",
  vendue: "vendue",
};

/** Texte lu par les lecteurs d'écran pour chaque place du plan. */
export function descriptionPlace(place: PlaceDeSeance): string {
  const pmr = place.accessiblePmr ? ", accessible PMR" : "";
  return `Rangée ${place.rangee}, place ${place.numero}, ${LIBELLES_ETAT[place.etat]}${pmr}`;
}

const LIBELLES_STATUT: Record<string, string> = {
  brouillon: "Brouillon",
  publiee: "Publiée",
  annulee: "Annulée",
  en_attente_paiement: "En attente de paiement",
  confirmee: "Confirmée",
  expiree: "Expirée",
};

/** Libellé lisible d'un statut stocké en base (« publiee » → « Publiée »). */
export function libelleStatut(statut: string): string {
  return LIBELLES_STATUT[statut] ?? statut;
}

/** La réservation en ligne ferme au début de la séance. */
export function reservationEnLigneOuverte(debutAt: Date, maintenant: Date = new Date()): boolean {
  return maintenant.getTime() < debutAt.getTime();
}
