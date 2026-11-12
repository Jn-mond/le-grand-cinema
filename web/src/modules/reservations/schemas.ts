import { z } from "zod";
import { ErreurApplication } from "../../lib/erreurs";
import { MAX_PLACES_PAR_RESERVATION } from "./regles";

/** Même règle que la contrainte de la base (reservation_email_coherent). */
const MOTIF_EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
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

/** Valide une donnée reçue ; en cas d'échec, liste les champs en erreur. */
export function valider<T>(schema: z.ZodType<T>, valeur: unknown): T {
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
