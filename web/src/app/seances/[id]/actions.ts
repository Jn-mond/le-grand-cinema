"use server";

import { refresh } from "next/cache";
import { ErreurApplication } from "@/lib/erreurs";
import { utilisateurConnecte } from "@/lib/session";
import { clientSupabaseServeur } from "@/lib/supabase-serveur";
import { DepotReservationsSupabase } from "@/modules/reservations/depot-supabase";
import {
  schemaCreationReservation,
  schemaVerrouillage,
  valider,
} from "@/modules/reservations/schemas";
import { creerReservation, verrouillerPlaces } from "@/modules/reservations/service";

export interface EtatReservation {
  statut: "initial" | "bloquee" | "refus" | "erreur";
  message: string;
  reference?: string;
  /** Identifiant de la réservation, pour le paiement (E4). */
  reservationId?: string;
  expireAt?: string;
  placeIds?: number[];
}

/**
 * E3 — ouvre une réservation et bloque les places choisies pendant 10 minutes (toutes ou aucune).
 * Mêmes services que l'API REST : la règle métier n'est écrite qu'une fois.
 */
export async function reserverPlaces(
  _etat: EtatReservation,
  donnees: FormData,
): Promise<EtatReservation> {
  try {
    const utilisateur = await utilisateurConnecte();
    const nomClient = String(donnees.get("nomClient") ?? "").trim();
    // Validation complète avant toute écriture : une saisie invalide ne crée pas de réservation.
    const demande = valider(schemaCreationReservation, {
      seanceId: Number(donnees.get("seanceId")),
      // Connecté : l'e-mail du compte fait foi, celui du formulaire est ignoré.
      email: utilisateur?.email ?? donnees.get("email"),
      nomClient: nomClient || undefined,
    });
    const { placeIds } = valider(schemaVerrouillage, {
      placeIds: donnees.getAll("placeIds").map(Number),
    });

    const depot = new DepotReservationsSupabase(clientSupabaseServeur());
    const reservation = await creerReservation(depot, {
      ...demande,
      utilisateurId: utilisateur?.id,
    });
    const verrous = await verrouillerPlaces(depot, reservation.id, placeIds);
    refresh();
    return {
      statut: "bloquee",
      message: "Vos places sont bloquées.",
      reference: reservation.reference,
      reservationId: reservation.id,
      expireAt: verrous.expireAt.toISOString(),
      placeIds: verrous.placeIds,
    };
  } catch (erreur) {
    if (erreur instanceof ErreurApplication) {
      if (erreur.code === "PLACES_INDISPONIBLES") refresh(); // remet le plan à jour
      const message =
        erreur.code === "REQUETE_INVALIDE"
          ? "Vérifiez votre adresse e-mail et les places choisies."
          : erreur.message;
      return { statut: "refus", message };
    }
    console.error("Réservation impossible", erreur);
    return { statut: "erreur", message: "Erreur inattendue : aucune place n’a été bloquée." };
  }
}
