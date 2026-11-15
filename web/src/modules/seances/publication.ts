import { z } from "zod";
import { ErreurApplication } from "../../lib/erreurs";

/** E7 — publier une séance (visible sur le site) ou la retirer (repasse en brouillon). */
export const schemaPublication = z.object({
  seanceId: z.coerce.number().int().positive(),
  action: z.enum(["publier", "retirer"]),
});

export type DemandePublication = z.infer<typeof schemaPublication>;

export type StatutSeance = "brouillon" | "publiee" | "annulee";

export interface EtatSeance {
  statut: StatutSeance;
  debutAt: Date;
}

export interface DepotPublication {
  lireSeance(seanceId: number): Promise<EtatSeance | null>;
  /** Places vendues ou en cours de réservation (verrou non expiré) pour la séance. */
  placesOccupees(seanceId: number, maintenant: Date): Promise<number>;
  /**
   * Passe la séance du statut « de » au statut « vers ». Renvoie false si la séance n'avait plus
   * le statut « de » ou avait commencé : quelqu'un l'a modifiée entre la lecture et l'écriture.
   */
  changerStatut(
    seanceId: number,
    de: StatutSeance,
    vers: StatutSeance,
    maintenant: Date,
  ): Promise<boolean>;
}

export interface ResultatPublication {
  seanceId: number;
  statut: StatutSeance;
  /** false si la séance avait déjà le statut demandé (double clic, deux onglets). */
  modifiee: boolean;
}

export async function changerPublication(
  depot: DepotPublication,
  demande: DemandePublication,
  maintenant: Date = new Date(),
): Promise<ResultatPublication> {
  const seance = await depot.lireSeance(demande.seanceId);
  if (!seance) {
    throw new ErreurApplication("SEANCE_INTROUVABLE", "Séance introuvable");
  }
  if (seance.debutAt.getTime() <= maintenant.getTime()) {
    throw new ErreurApplication(
      "SEANCE_NON_MODIFIABLE",
      "Une séance commencée ou passée ne peut plus être publiée ni retirée",
    );
  }
  if (seance.statut === "annulee") {
    throw new ErreurApplication(
      "SEANCE_NON_MODIFIABLE",
      "Une séance annulée ne peut plus être publiée ni retirée",
    );
  }

  const [de, vers]: [StatutSeance, StatutSeance] =
    demande.action === "publier" ? ["brouillon", "publiee"] : ["publiee", "brouillon"];
  if (seance.statut === vers) {
    return { seanceId: demande.seanceId, statut: vers, modifiee: false };
  }
  if (
    demande.action === "retirer" &&
    (await depot.placesOccupees(demande.seanceId, maintenant)) > 0
  ) {
    // Retirer la séance la cacherait à des spectateurs qui ont déjà des places : il faut l'annuler (E11).
    throw new ErreurApplication(
      "SEANCE_AVEC_RESERVATIONS",
      "Des places sont vendues ou en cours de réservation : la séance ne peut pas être retirée",
    );
  }
  if (!(await depot.changerStatut(demande.seanceId, de, vers, maintenant))) {
    throw new ErreurApplication(
      "SEANCE_NON_MODIFIABLE",
      "La séance a été modifiée entre-temps : rechargez la page",
    );
  }
  return { seanceId: demande.seanceId, statut: vers, modifiee: true };
}
