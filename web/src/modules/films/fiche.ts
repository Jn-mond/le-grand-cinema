import { z } from "zod";

/** E1 — fiche d'un film : durée, public, affiche, sortie. */
export const schemaIdentifiantFilm = z.coerce.number().int().positive();

/** 120 → « 2 h », 95 → « 1 h 35 », 45 → « 45 min ». */
export function formaterDuree(minutes: number): string {
  const heures = Math.floor(minutes / 60);
  const reste = minutes % 60;
  if (heures === 0) return `${reste} min`;
  return reste === 0 ? `${heures} h` : `${heures} h ${String(reste).padStart(2, "0")}`;
}

/** Âge minimum (0, 10, 12, 16 ou 18 en base) en mention lisible. */
export function libelleAge(ageMinimum: number): string {
  return ageMinimum === 0 ? "Tous publics" : `Interdit aux moins de ${ageMinimum} ans`;
}

/**
 * Adresse d'affiche utilisable : seule une adresse https bien formée est affichée. Une adresse
 * http (contenu mixte bloqué par le navigateur) ou mal saisie laisse place à l'encart « affiche à venir ».
 */
export function afficheSure(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

const formatDateSortie = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC", // une date sans heure : lue et affichée telle quelle, sans décalage de fuseau
});

/** « 2026-10-16 » (colonne date) → « 16 octobre 2026 ». */
export function formaterDateSortie(date: string | null): string | null {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  return formatDateSortie.format(new Date(`${date}T00:00:00Z`));
}
