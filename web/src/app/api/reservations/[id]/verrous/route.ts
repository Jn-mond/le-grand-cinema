import { lireCorpsJson, reponseJson, traiterRequete } from "@/lib/http";
import { clientSupabaseServeur } from "@/lib/supabase-serveur";
import { DepotReservationsSupabase } from "@/modules/reservations/depot-supabase";
import {
  schemaIdentifiantReservation,
  schemaVerrouillage,
  valider,
} from "@/modules/reservations/schemas";
import { verrouillerPlaces } from "@/modules/reservations/service";

/** POST /api/reservations/{id}/verrous — bloque les places choisies (toutes ou aucune). */
export async function POST(
  requete: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  return traiterRequete(async () => {
    const reservationId = valider(schemaIdentifiantReservation, (await params).id);
    const { placeIds } = valider(schemaVerrouillage, await lireCorpsJson(requete));
    const resultat = await verrouillerPlaces(
      new DepotReservationsSupabase(clientSupabaseServeur()),
      reservationId,
      placeIds,
    );
    return reponseJson(resultat);
  });
}
