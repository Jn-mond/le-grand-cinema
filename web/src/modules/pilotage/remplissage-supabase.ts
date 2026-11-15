import type { SupabaseClient } from "@supabase/supabase-js";
import { calculerRemplissage, type Remplissage } from "./remplissage";

/**
 * Remplissage des séances demandées. Les places offertes et vendues viennent de la vue
 * vue_remplissage_seance (testée en base, T28) ; les places en cours de réservation, des verrous
 * non expirés.
 */
export async function lireRemplissages(
  client: SupabaseClient,
  seanceIds: number[],
  maintenant: Date = new Date(),
): Promise<Map<number, Remplissage>> {
  const resultat = new Map<number, Remplissage>();
  if (seanceIds.length === 0) return resultat;
  const [vue, verrous] = await Promise.all([
    client
      .from("vue_remplissage_seance")
      .select("seance_id, places_offertes, places_occupees")
      .in("seance_id", seanceIds),
    client
      .from("verrou_place")
      .select("seance_id")
      .in("seance_id", seanceIds)
      .gt("expire_at", maintenant.toISOString()),
  ]);
  if (vue.error) throw new Error(`Lecture du remplissage impossible : ${vue.error.message}`);
  if (verrous.error) throw new Error(`Lecture des verrous impossible : ${verrous.error.message}`);

  const bloquees = new Map<number, number>();
  for (const { seance_id: id } of verrous.data as { seance_id: number }[]) {
    bloquees.set(id, (bloquees.get(id) ?? 0) + 1);
  }
  const lignes = vue.data as {
    seance_id: number;
    places_offertes: number;
    places_occupees: number;
  }[];
  for (const ligne of lignes) {
    resultat.set(
      ligne.seance_id,
      calculerRemplissage(
        Number(ligne.places_offertes),
        Number(ligne.places_occupees),
        bloquees.get(ligne.seance_id) ?? 0,
      ),
    );
  }
  return resultat;
}
