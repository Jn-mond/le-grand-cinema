import { lireCorpsJson, reponseJson, traiterRequete } from "@/lib/http";
import { clientSupabaseServeur } from "@/lib/supabase-serveur";
import { DepotReservationsSupabase } from "@/modules/reservations/depot-supabase";
import { schemaCreationReservation, valider } from "@/modules/reservations/schemas";
import { creerReservation } from "@/modules/reservations/service";

/** POST /api/reservations — ouvre une réservation (10 minutes pour choisir et payer). */
export async function POST(requete: Request): Promise<Response> {
  return traiterRequete(async () => {
    const demande = valider(schemaCreationReservation, await lireCorpsJson(requete));
    const reservation = await creerReservation(
      new DepotReservationsSupabase(clientSupabaseServeur()),
      demande,
    );
    return reponseJson(reservation, 201);
  });
}
