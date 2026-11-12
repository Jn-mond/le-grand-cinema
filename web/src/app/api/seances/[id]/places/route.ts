import { reponseJson, traiterRequete } from "@/lib/http";
import { clientSupabaseServeur } from "@/lib/supabase-serveur";
import { schemaIdentifiantSeance, valider } from "@/modules/reservations/schemas";
import { DepotSeancesSupabase } from "@/modules/seances/depot-supabase";
import { obtenirPlanDeSalle } from "@/modules/seances/service";

/** GET /api/seances/{id}/places — plan de salle d'une séance publiée. */
export async function GET(
  _requete: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  return traiterRequete(async () => {
    const seanceId = valider(schemaIdentifiantSeance, (await params).id);
    const plan = await obtenirPlanDeSalle(new DepotSeancesSupabase(clientSupabaseServeur()), seanceId);
    return reponseJson(plan);
  });
}
