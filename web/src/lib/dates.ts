import { ErreurApplication } from "./erreurs";

/** Fuseau du cinéma : les horaires sont saisis et affichés à l'heure de Paris. */
const FUSEAU = "Europe/Paris";

const formatDecalage = new Intl.DateTimeFormat("en-US", {
  timeZone: FUSEAU,
  timeZoneName: "longOffset",
});

/** Décalage de l'heure de Paris par rapport à UTC, en minutes (60 en hiver, 120 en été). */
export function decalageParisMinutes(instant: Date): number {
  const nom = formatDecalage.formatToParts(instant).find((p) => p.type === "timeZoneName")?.value;
  const morceaux = /^GMT([+-])(\d{2}):(\d{2})$/.exec(nom ?? "");
  if (!morceaux) return 0;
  const signe = morceaux[1] === "-" ? -1 : 1;
  return signe * (Number(morceaux[2]) * 60 + Number(morceaux[3]));
}

/**
 * Convertit une date et une heure saisies à l'heure de Paris (format « 2026-11-20T20:30 »,
 * celui des champs datetime-local) en instant UTC, en tenant compte de l'heure d'été.
 */
export function heureParisVersUtc(saisie: string): Date {
  const morceaux = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(saisie);
  if (!morceaux) {
    throw new ErreurApplication("REQUETE_INVALIDE", "Date et heure invalides");
  }
  const [annee, mois, jour, heure, minute] = morceaux.slice(1).map(Number);
  const commeSiUtc = Date.UTC(annee, mois - 1, jour, heure, minute);
  const verification = new Date(commeSiUtc);
  if (
    verification.getUTCMonth() !== mois - 1 ||
    verification.getUTCDate() !== jour ||
    heure > 23 ||
    minute > 59
  ) {
    throw new ErreurApplication("REQUETE_INVALIDE", "Date et heure invalides");
  }
  // Deux passes : la seconde corrige le cas où le décalage change entre les deux instants.
  let instant = commeSiUtc - decalageParisMinutes(new Date(commeSiUtc)) * 60_000;
  instant = commeSiUtc - decalageParisMinutes(new Date(instant)) * 60_000;
  return new Date(instant);
}

const formatDateHeure = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "full",
  timeStyle: "short",
  timeZone: FUSEAU,
});

/** Exemple : « vendredi 20 novembre 2026 à 20:30 ». */
export function formaterDateHeure(instant: Date): string {
  return formatDateHeure.format(instant);
}

const formatPrix = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

/** Exemple : 1250 → « 12,50 € ». */
export function formaterPrix(centimes: number): string {
  return formatPrix.format(centimes / 100);
}
