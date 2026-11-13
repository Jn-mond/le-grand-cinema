import type { SupabaseClient } from "@supabase/supabase-js";
import type { DepotSeances, EtatPlace, PlaceDeSeance } from "./depot";

interface LignePlace {
  place_id: number;
  rangee: string;
  numero: number;
  accessible_pmr: boolean;
  position_x: number | null;
  position_y: number | null;
  etat: EtatPlace;
}

/** Implémentation du dépôt avec Supabase (vue vue_places_seance). */
export class DepotSeancesSupabase implements DepotSeances {
  constructor(private readonly client: SupabaseClient) {}

  async listerPlaces(seanceId: number): Promise<PlaceDeSeance[] | null> {
    const seance = await this.client
      .from("seance")
      .select("id")
      .eq("id", seanceId)
      .eq("statut", "publiee")
      .maybeSingle();
    if (seance.error) throw new Error(`Lecture de la séance impossible : ${seance.error.message}`);
    if (!seance.data) return null;

    const { data, error } = await this.client
      .from("vue_places_seance")
      .select("place_id, rangee, numero, accessible_pmr, position_x, position_y, etat")
      .eq("seance_id", seanceId)
      .order("rangee")
      .order("numero");
    if (error) throw new Error(`Lecture des places impossible : ${error.message}`);

    return (data as LignePlace[]).map((ligne) => ({
      id: ligne.place_id,
      rangee: ligne.rangee,
      numero: ligne.numero,
      accessiblePmr: ligne.accessible_pmr,
      positionX: ligne.position_x,
      positionY: ligne.position_y,
      etat: ligne.etat,
    }));
  }
}
