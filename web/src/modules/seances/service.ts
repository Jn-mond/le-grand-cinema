import { ErreurApplication } from "../../lib/erreurs";
import type { DepotSeances, EtatPlace, PlaceDeSeance } from "./depot";

export interface PlanDeSalle {
  seanceId: number;
  places: PlaceDeSeance[];
  resume: Record<EtatPlace, number>;
}

/** E2 / E3 — plan de salle d'une séance : état de chaque place, pour choisir les siens. */
export async function obtenirPlanDeSalle(
  depot: DepotSeances,
  seanceId: number,
): Promise<PlanDeSalle> {
  const places = await depot.listerPlaces(seanceId);
  if (!places) {
    throw new ErreurApplication("SEANCE_INTROUVABLE", "Séance introuvable");
  }
  const resume: Record<EtatPlace, number> = { libre: 0, verrouillee: 0, vendue: 0 };
  for (const place of places) {
    resume[place.etat] += 1;
  }
  return { seanceId, places, resume };
}
