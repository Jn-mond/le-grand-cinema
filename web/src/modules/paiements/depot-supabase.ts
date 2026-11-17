import type { SupabaseClient } from "@supabase/supabase-js";
import type { CommandeOuverte, DepotPaiements, ResultatConfirmation } from "./service";

interface LigneOuverture {
  commande_id: string;
  montant: number;
  nb_places: number;
  prix_unitaire: number;
  email_client: string;
  titre_film: string;
  debut_seance: string;
}

/** Erreurs levées par ouvrir_commande() (migration 0008). */
const REFUS_OUVERTURE: Record<string, "introuvable" | "non_modifiable" | "expiree"> = {
  LGC02: "expiree",
  LGC03: "non_modifiable",
  LGC04: "introuvable",
  "22P02": "introuvable", // identifiant qui n'est pas un UUID
};

/** Commandes et événements de paiement, avec Supabase (fonctions de la migration 0008). */
export class DepotPaiementsSupabase implements DepotPaiements {
  constructor(private readonly client: SupabaseClient) {}

  async commandesEnAttente(reservationId: string) {
    const { data, error } = await this.client
      .from("commande")
      .select("id, prestataire_session_id")
      .eq("reservation_id", reservationId)
      .eq("statut", "en_attente");
    if (error) throw new Error(`Lecture des commandes impossible : ${error.message}`);
    return ((data ?? []) as { id: string; prestataire_session_id: string | null }[]).map(
      (ligne) => ({ id: ligne.id, sessionId: ligne.prestataire_session_id }),
    );
  }

  async ouvrirCommande(
    reservationId: string,
  ): Promise<CommandeOuverte | "introuvable" | "non_modifiable" | "expiree"> {
    const { data, error } = await this.client.rpc("ouvrir_commande", {
      p_reservation: reservationId,
    });
    if (error) {
      const refus = REFUS_OUVERTURE[error.code];
      if (refus) return refus;
      throw new Error(`Ouverture de la commande impossible : ${error.message}`);
    }
    const [ligne] = data as LigneOuverture[];
    return {
      commandeId: ligne.commande_id,
      montantCentimes: ligne.montant,
      nbPlaces: ligne.nb_places,
      prixUnitaireCentimes: ligne.prix_unitaire,
      email: ligne.email_client,
      titreFilm: ligne.titre_film,
      debutSeance: new Date(ligne.debut_seance),
    };
  }

  async attacherSession(commandeId: string, sessionId: string): Promise<void> {
    const { error } = await this.client
      .from("commande")
      .update({ prestataire_session_id: sessionId })
      .eq("id", commandeId);
    if (error) throw new Error(`Enregistrement de la session impossible : ${error.message}`);
  }

  async confirmerCommande(
    commandeId: string,
    paiementId: string,
    montantCentimes: number,
  ): Promise<ResultatConfirmation> {
    const { data, error } = await this.client.rpc("confirmer_commande", {
      p_commande: commandeId,
      p_paiement: paiementId,
      p_montant: montantCentimes,
    });
    if (error?.code === "22P02") return "introuvable";
    if (error) throw new Error(`Confirmation de la commande impossible : ${error.message}`);
    return data as ResultatConfirmation;
  }

  async abandonnerCommande(commandeId: string): Promise<void> {
    const { error } = await this.client.rpc("abandonner_commande", { p_commande: commandeId });
    if (error && error.code !== "22P02") {
      throw new Error(`Abandon de la commande impossible : ${error.message}`);
    }
  }

  async debuterEvenement(id: string, type: string): Promise<boolean> {
    const { error } = await this.client
      .from("evenement_paiement")
      .upsert({ id, type }, { onConflict: "id", ignoreDuplicates: true });
    if (error) throw new Error(`Enregistrement de l'événement impossible : ${error.message}`);
    const { data, error: erreurLecture } = await this.client
      .from("evenement_paiement")
      .select("traite_at")
      .eq("id", id)
      .single();
    if (erreurLecture)
      throw new Error(`Lecture de l'événement impossible : ${erreurLecture.message}`);
    return (data as { traite_at: string | null }).traite_at === null;
  }

  async terminerEvenement(id: string): Promise<void> {
    const { error } = await this.client
      .from("evenement_paiement")
      .update({ traite_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw new Error(`Marquage de l'événement impossible : ${error.message}`);
  }
}

export interface ReservationPayee {
  reference: string;
  statut: string;
  titreFilm: string;
  debutSeance: Date;
  salle: string;
  derniereCommande: string | null;
  bloqueeJusqua: Date | null;
  montantCentimes: number | null;
  billets: { rangee: string; numero: number; prixCentimes: number }[];
}

interface LigneReservationPayee {
  reference: string;
  statut: string;
  seance: { debut_at: string; film: { titre: string }; salle: { nom: string } };
}

/**
 * E4 — ce que la page de retour du paiement affiche pour une réservation. Lectures séparées
 * plutôt qu'imbriquées : billets et places sont reliés par une clé étrangère composite.
 */
export async function lireReservationPayee(
  client: SupabaseClient,
  reservationId: string,
): Promise<ReservationPayee | null> {
  const { data, error } = await client
    .from("reservation")
    .select(
      "reference, statut, seance:seance_id (debut_at, film:film_id (titre), salle:salle_id (nom))",
    )
    .eq("id", reservationId)
    .maybeSingle();
  if (error?.code === "22P02") return null; // identifiant qui n'est pas un UUID
  if (error) throw new Error(`Lecture de la réservation impossible : ${error.message}`);
  if (!data) return null;
  const ligne = data as unknown as LigneReservationPayee;

  const [commandes, verrous, billets] = await Promise.all([
    client
      .from("commande")
      .select("statut, montant_centimes")
      .eq("reservation_id", reservationId)
      .order("cree_at", { ascending: false })
      .limit(1),
    client.from("verrou_place").select("expire_at").eq("reservation_id", reservationId),
    client
      .from("billet")
      .select("place_id, prix_centimes")
      .eq("reservation_id", reservationId)
      .neq("statut", "annule"),
  ]);
  const echec = commandes.error ?? verrous.error ?? billets.error;
  if (echec) throw new Error(`Lecture du paiement impossible : ${echec.message}`);

  const lignesBillets = (billets.data ?? []) as { place_id: number; prix_centimes: number }[];
  const places = new Map<number, { rangee: string; numero: number }>();
  if (lignesBillets.length > 0) {
    const { data: lignesPlaces, error: erreurPlaces } = await client
      .from("place")
      .select("id, rangee, numero")
      .in(
        "id",
        lignesBillets.map((billet) => billet.place_id),
      );
    if (erreurPlaces) throw new Error(`Lecture des places impossible : ${erreurPlaces.message}`);
    for (const place of (lignesPlaces ?? []) as { id: number; rangee: string; numero: number }[]) {
      places.set(Number(place.id), place);
    }
  }

  const derniere = ((commandes.data ?? []) as { statut: string; montant_centimes: number }[])[0];
  const expirations = ((verrous.data ?? []) as { expire_at: string }[]).map((v) =>
    new Date(v.expire_at).getTime(),
  );
  return {
    reference: ligne.reference,
    statut: ligne.statut,
    titreFilm: ligne.seance.film.titre,
    debutSeance: new Date(ligne.seance.debut_at),
    salle: ligne.seance.salle.nom,
    derniereCommande: derniere?.statut ?? null,
    bloqueeJusqua: expirations.length > 0 ? new Date(Math.min(...expirations)) : null,
    montantCentimes: derniere?.montant_centimes ?? null,
    billets: lignesBillets
      .map((billet) => ({
        rangee: places.get(Number(billet.place_id))?.rangee ?? "?",
        numero: places.get(Number(billet.place_id))?.numero ?? 0,
        prixCentimes: billet.prix_centimes,
      }))
      .sort((a, b) => a.rangee.localeCompare(b.rangee) || a.numero - b.numero),
  };
}
