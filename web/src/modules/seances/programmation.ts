import { z } from "zod";
import { heureParisVersUtc } from "../../lib/dates";
import { ErreurApplication } from "../../lib/erreurs";

/** Temps de nettoyage de la salle ajouté après chaque projection, avant la séance suivante. */
export const NETTOYAGE_MINUTES = 15;

export type VersionSeance = "vf" | "vostfr" | "vo";

/** Saisie du formulaire de programmation (E7), telle qu'envoyée par le navigateur. */
export const schemaProgrammation = z.object({
  filmId: z.coerce.number().int().positive(),
  salleId: z.coerce.number().int().positive(),
  debut: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Date et heure invalides"),
  version: z.enum(["vf", "vostfr", "vo"]),
  prix: z
    .string()
    .trim()
    .regex(/^\d{1,3}([.,]\d{1,2})?$/, "Prix invalide (exemple : 12,50)")
    .transform((texte) => Math.round(Number(texte.replace(",", ".")) * 100)),
  publier: z.literal("on").optional(),
});

export type SaisieSeance = z.infer<typeof schemaProgrammation>;

export interface NouvelleSeance {
  filmId: number;
  salleId: number;
  debutAt: Date;
  finAt: Date;
  version: VersionSeance;
  prixCentimes: number;
  statut: "publiee" | "brouillon";
}

export interface DepotProgrammation {
  dureeFilm(filmId: number): Promise<number | null>;
  salleExiste(salleId: number): Promise<boolean>;
  /** Crée la séance ; « chevauchement » si la salle est déjà occupée (contrainte d'exclusion). */
  creer(seance: NouvelleSeance): Promise<{ id: number } | "chevauchement">;
}

/** Fin de séance : début + durée du film + nettoyage. */
export function finDeSeance(debut: Date, dureeMinutes: number): Date {
  return new Date(debut.getTime() + (dureeMinutes + NETTOYAGE_MINUTES) * 60_000);
}

/** E7 — programmer une séance dans une salle, sans chevauchement avec une autre séance. */
export async function programmerSeance(
  depot: DepotProgrammation,
  saisie: SaisieSeance,
  maintenant: Date = new Date(),
): Promise<{ id: number } & NouvelleSeance> {
  const debutAt = heureParisVersUtc(saisie.debut);
  if (debutAt.getTime() <= maintenant.getTime()) {
    throw new ErreurApplication("SEANCE_DANS_LE_PASSE", "La séance doit commencer dans le futur");
  }
  const duree = await depot.dureeFilm(saisie.filmId);
  if (duree === null) {
    throw new ErreurApplication("FILM_INTROUVABLE", "Film introuvable");
  }
  if (!(await depot.salleExiste(saisie.salleId))) {
    throw new ErreurApplication("SALLE_INTROUVABLE", "Salle introuvable");
  }
  const seance: NouvelleSeance = {
    filmId: saisie.filmId,
    salleId: saisie.salleId,
    debutAt,
    finAt: finDeSeance(debutAt, duree),
    version: saisie.version,
    prixCentimes: saisie.prix,
    statut: saisie.publier ? "publiee" : "brouillon",
  };
  const resultat = await depot.creer(seance);
  if (resultat === "chevauchement") {
    throw new ErreurApplication(
      "SEANCE_EN_CONFLIT",
      "La salle est déjà occupée sur ce créneau (nettoyage de 15 minutes compris)",
    );
  }
  return { id: resultat.id, ...seance };
}
