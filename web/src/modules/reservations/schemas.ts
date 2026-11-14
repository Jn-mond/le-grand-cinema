import { z } from "zod";
import { ErreurApplication } from "../../lib/erreurs";
import { MAX_PLACES_PAR_RESERVATION } from "./regles";

/**
 * Adresse e-mail : partie locale, « @ », puis un domaine fait de segments séparés par des points.
 * Chaque segment exclut le point : l'expression s'évalue en temps linéaire, sans retour arrière
 * exponentiel (ReDoS, correctif C2). Elle est un peu plus stricte que la contrainte de la base,
 * qui reste le dernier rempart.
 */
const MOTIF_EMAIL = /^[^@\s]+@[^@\s.]+(?:\.[^@\s.]+)+$/;
const MOTIF_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const schemaCreationReservation = z
  .object({
    seanceId: z.number().int().positive(),
    email: z.string().trim().max(254).regex(MOTIF_EMAIL, "Adresse e-mail invalide"),
    nomClient: z.string().trim().min(1).max(100).optional(),
  })
  .strict();

export const schemaVerrouillage = z
  .object({
    placeIds: z.array(z.number().int().positive()).min(1).max(MAX_PLACES_PAR_RESERVATION),
  })
  .strict();

export const schemaIdentifiantReservation = z
  .string()
  .regex(MOTIF_UUID, "Identifiant de réservation invalide");

export const schemaIdentifiantSeance = z.coerce.number().int().positive();

/**
 * Valide une donnée reçue et renvoie la valeur obtenue (éventuellement transformée par le
 * schéma, par exemple un prix saisi en texte converti en centimes) ; en cas d'échec, liste
 * les champs en erreur.
 */
export function valider<S extends z.ZodType>(schema: S, valeur: unknown): z.output<S> {
  const resultat = schema.safeParse(valeur);
  if (!resultat.success) {
    throw new ErreurApplication("REQUETE_INVALIDE", "Données invalides", {
      erreurs: resultat.error.issues.map((probleme) => ({
        champ: probleme.path.join("."),
        message: probleme.message,
      })),
    });
  }
  return resultat.data;
}
