import { z } from "zod";
import { ErreurApplication } from "../../lib/erreurs";
import { afficheSure } from "./fiche";

/** Âges minimaux admis en base (contrainte film_age_valide). */
export const AGES_MINIMUMS = [0, 10, 12, 16, 18] as const;

/** Texte facultatif : espaces retirés, chaîne vide enregistrée comme absente (null). */
const texteFacultatif = (max: number, libelle: string) =>
  z
    .string()
    .trim()
    .max(max, `${libelle} : ${max} caractères au plus`)
    .transform((texte) => (texte === "" ? null : texte));

/** Date au format AAAA-MM-JJ qui existe vraiment (le 31 février est refusé). */
function dateExiste(texte: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texte)) return false;
  const date = new Date(`${texte}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(texte);
}

/** E7 — saisie du formulaire « Créer ou modifier un film », telle qu'envoyée par le navigateur. */
export const schemaFilm = z.object({
  titre: z
    .string()
    .trim()
    .min(1, "Le titre est obligatoire")
    .max(150, "Titre : 150 caractères au plus"),
  titreOriginal: texteFacultatif(150, "Titre original"),
  dureeMinutes: z.coerce
    .number({ error: "Durée invalide" })
    .int("La durée est un nombre entier de minutes")
    .min(1, "Durée : de 1 à 600 minutes")
    .max(600, "Durée : de 1 à 600 minutes"),
  ageMinimum: z.coerce
    .number({ error: "Âge minimal invalide" })
    .refine((age) => (AGES_MINIMUMS as readonly number[]).includes(age), "Âge minimal invalide"),
  dateSortie: z
    .string()
    .trim()
    .refine((texte) => texte === "" || dateExiste(texte), "Date de sortie invalide")
    .transform((texte) => (texte === "" ? null : texte)),
  synopsis: texteFacultatif(2000, "Synopsis"),
  afficheUrl: texteFacultatif(500, "Adresse de l’affiche").refine(
    (url) => url === null || afficheSure(url) !== null,
    "L’affiche doit être une adresse https",
  ),
  actif: z
    .literal("on")
    .optional()
    .transform((valeur) => valeur === "on"),
  genres: z
    .array(z.coerce.number().int().positive())
    .max(10, "10 genres au plus")
    .transform((ids) => [...new Set(ids)].sort((a, b) => a - b)),
});

export type FilmSaisi = z.output<typeof schemaFilm>;

/**
 * Prépare les données du formulaire pour la validation. Object.fromEntries ne garde qu'une valeur
 * par nom : les genres cochés, qui portent tous le nom « genres », sont donc lus à part.
 */
export function lireFormulaireFilm(donnees: FormData): Record<string, unknown> {
  return { ...Object.fromEntries(donnees), genres: donnees.getAll("genres") };
}

export interface DepotGestionFilms {
  /** Parmi les identifiants demandés, ceux des genres qui existent. */
  genresExistants(ids: number[]): Promise<number[]>;
  /**
   * Crée le film (id null) ou le modifie, avec ses genres, en une seule opération.
   * « introuvable » si le film à modifier n'existe pas ; « duree_verrouillee » si sa durée
   * change alors que des séances à venir en dépendent.
   */
  enregistrer(
    film: FilmSaisi,
    id: number | null,
  ): Promise<number | "introuvable" | "duree_verrouillee">;
}

/** E7 — créer (id null) ou modifier un film. Renvoie l'identifiant du film. */
export async function enregistrerFilm(
  depot: DepotGestionFilms,
  film: FilmSaisi,
  id: number | null = null,
): Promise<number> {
  if (film.genres.length > 0) {
    const connus = new Set(await depot.genresExistants(film.genres));
    const inconnus = film.genres.filter((genre) => !connus.has(genre));
    if (inconnus.length > 0) {
      throw new ErreurApplication("GENRE_INTROUVABLE", "Genre inconnu", { genres: inconnus });
    }
  }
  const resultat = await depot.enregistrer(film, id);
  if (resultat === "introuvable") {
    throw new ErreurApplication("FILM_INTROUVABLE", "Film introuvable");
  }
  if (resultat === "duree_verrouillee") {
    throw new ErreurApplication(
      "FILM_AVEC_SEANCES",
      "La durée ne peut plus changer : l’heure de fin des séances à venir en dépend",
    );
  }
  return resultat;
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
