/** E9 — remplissage d'une séance : places vendues rapportées aux places offertes par la salle. */
export interface Remplissage {
  placesOffertes: number;
  placesVendues: number;
  /** Places bloquées par une réservation en cours (verrou non expiré), pas encore vendues. */
  placesBloquees: number;
  placesLibres: number;
  /** Pourcentage arrondi au dixième ; null si la salle n'a aucune place active. */
  tauxPct: number | null;
  complet: boolean;
}

const formatTaux = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });

export function calculerRemplissage(
  placesOffertes: number,
  placesVendues: number,
  placesBloquees: number,
): Remplissage {
  const libres = Math.max(0, placesOffertes - placesVendues - placesBloquees);
  return {
    placesOffertes,
    placesVendues,
    placesBloquees,
    placesLibres: libres,
    tauxPct: placesOffertes > 0 ? Math.round((1000 * placesVendues) / placesOffertes) / 10 : null,
    complet: placesOffertes > 0 && placesVendues >= placesOffertes,
  };
}

/** « 4,2 % », ou un tiret quand le taux n'a pas de sens (salle sans place). */
export function libelleTaux(remplissage: Remplissage): string {
  return remplissage.tauxPct === null ? "—" : `${formatTaux.format(remplissage.tauxPct)} %`;
}

/** Détail lisible : « 1 vendue sur 24 · 2 en cours de réservation ». */
export function detailRemplissage(remplissage: Remplissage): string {
  const {
    placesVendues: vendues,
    placesOffertes: offertes,
    placesBloquees: bloquees,
  } = remplissage;
  const base = `${vendues} vendue${vendues > 1 ? "s" : ""} sur ${offertes}`;
  if (remplissage.complet) return `${base} · complet`;
  return bloquees > 0 ? `${base} · ${bloquees} en cours de réservation` : base;
}
