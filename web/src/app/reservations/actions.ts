"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { ErreurApplication } from "@/lib/erreurs";
import { passerelleStripe } from "@/lib/stripe-serveur";
import { clientSupabaseServeur } from "@/lib/supabase-serveur";
import { DepotPaiementsSupabase } from "@/modules/paiements/depot-supabase";
import { demarrerPaiement } from "@/modules/paiements/service";

export interface EtatPaiementAction {
  message: string;
}

/**
 * E4 — ouvre la page de paiement Stripe pour les places bloquées d'une réservation, puis y
 * redirige le client. Stripe le renverra sur /reservations/[id] (paiement réussi ou abandonné).
 */
export async function payer(
  _etat: EtatPaiementAction,
  donnees: FormData,
): Promise<EtatPaiementAction> {
  const reservationId = z.uuid().safeParse(donnees.get("reservationId"));
  if (!reservationId.success) return { message: "Réservation introuvable." };

  let adressePaiement: string;
  try {
    const entetes = await headers();
    const origine = entetes.get("origin") ?? `https://${entetes.get("host")}`;
    const retour = `${origine}/reservations/${reservationId.data}?paiement=`;
    adressePaiement = await demarrerPaiement(
      new DepotPaiementsSupabase(clientSupabaseServeur()),
      passerelleStripe(),
      reservationId.data,
      { succes: `${retour}succes`, abandon: `${retour}abandon` },
    );
  } catch (erreur) {
    if (erreur instanceof ErreurApplication && erreur.code !== "CONFIGURATION_MANQUANTE") {
      return { message: erreur.message };
    }
    console.error("Ouverture du paiement impossible", erreur);
    return { message: "Le paiement ne peut pas démarrer pour l’instant : aucun montant débité." };
  }
  redirect(adressePaiement); // hors du try : redirect() interrompt l'action par une exception
}
