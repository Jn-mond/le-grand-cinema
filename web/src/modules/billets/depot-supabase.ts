import type { SupabaseClient } from "@supabase/supabase-js";
import type { Controle, DepotControle, ResultatControle } from "./controle";

interface LigneControle {
  resultat: ResultatControle;
  titre_film: string | null;
  debut_seance: string | null;
  nom_salle: string | null;
  rangee_place: string | null;
  numero_place: number | null;
  utilise_le: string | null;
}

/** Contrôle à l'entrée avec Supabase (fonction controler_billet, migration 0009). */
export class DepotControleSupabase implements DepotControle {
  constructor(private readonly client: SupabaseClient) {}

  async controler(jeton: string): Promise<Controle> {
    const { data, error } = await this.client.rpc("controler_billet", { p_jeton: jeton });
    if (error) throw new Error(`Contrôle du billet impossible : ${error.message}`);
    const [ligne] = data as LigneControle[];
    return {
      resultat: ligne.resultat,
      film: ligne.titre_film,
      debutSeance: ligne.debut_seance ? new Date(ligne.debut_seance) : null,
      salle: ligne.nom_salle,
      place: ligne.rangee_place ? `${ligne.rangee_place}${ligne.numero_place}` : null,
      utiliseLe: ligne.utilise_le ? new Date(ligne.utilise_le) : null,
    };
  }
}
