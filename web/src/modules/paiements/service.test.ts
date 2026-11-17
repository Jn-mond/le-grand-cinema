import { describe, expect, it } from "vitest";
import { ErreurApplication } from "../../lib/erreurs";
import {
  DUREE_PAGE_PAIEMENT_MS,
  demarrerPaiement,
  traiterEvenement,
  type CommandeOuverte,
  type DemandeSession,
  type DepotPaiements,
  type PasserellePaiement,
  type ResultatConfirmation,
} from "./service";

const RESERVATION = "11111111-1111-4111-8111-111111111111";
const MAINTENANT = new Date("2026-11-20T17:00:00Z");
const URLS = { succes: "https://site.test/succes", abandon: "https://site.test/abandon" };

const COMMANDE: CommandeOuverte = {
  commandeId: "c-1",
  montantCentimes: 2500,
  nbPlaces: 2,
  prixUnitaireCentimes: 1250,
  email: "client@exemple.test",
  titreFilm: "Le Dernier Métro",
  debutSeance: new Date("2026-11-20T19:30:00Z"),
};

interface Options {
  enAttente?: { id: string; sessionId: string | null }[];
  ouverture?: CommandeOuverte | "introuvable" | "non_modifiable" | "expiree";
  confirmation?: ResultatConfirmation;
  dejaTraite?: boolean;
  expirationRefusee?: boolean;
}

function banc(options: Options = {}) {
  const journal: string[] = [];
  const sessions: DemandeSession[] = [];
  const depot: DepotPaiements = {
    async commandesEnAttente() {
      return options.enAttente ?? [];
    },
    async ouvrirCommande(id) {
      journal.push(`ouvrir ${id}`);
      return options.ouverture ?? COMMANDE;
    },
    async attacherSession(commandeId, sessionId) {
      journal.push(`attacher ${commandeId} ${sessionId}`);
    },
    async confirmerCommande(commandeId, paiementId, montant) {
      journal.push(`confirmer ${commandeId} ${paiementId} ${montant}`);
      return options.confirmation ?? "confirmee";
    },
    async abandonnerCommande(commandeId) {
      journal.push(`abandonner ${commandeId}`);
    },
    async debuterEvenement(id) {
      journal.push(`debuter ${id}`);
      return !options.dejaTraite;
    },
    async terminerEvenement(id) {
      journal.push(`terminer ${id}`);
    },
  };
  const passerelle: PasserellePaiement = {
    async creerSession(demande) {
      sessions.push(demande);
      return { id: "cs_test_1", url: "https://checkout.stripe.test/cs_test_1" };
    },
    async expirerSession(id) {
      journal.push(`expirer ${id}`);
      if (options.expirationRefusee) throw new Error("session déjà terminée");
    },
    async capturer(id) {
      journal.push(`capturer ${id}`);
    },
    async annuler(id) {
      journal.push(`annuler ${id}`);
    },
  };
  return { depot, passerelle, journal, sessions };
}

describe("demarrerPaiement", () => {
  it("ouvre une commande et renvoie l'adresse de la page de paiement", async () => {
    const { depot, passerelle, journal, sessions } = banc();
    const url = await demarrerPaiement(depot, passerelle, RESERVATION, URLS, MAINTENANT);
    expect(url).toBe("https://checkout.stripe.test/cs_test_1");
    expect(journal).toEqual([`ouvrir ${RESERVATION}`, "attacher c-1 cs_test_1"]);
    expect(sessions[0]).toMatchObject({
      commandeId: "c-1",
      reservationId: RESERVATION,
      quantite: 2,
      prixUnitaireCentimes: 1250,
      email: "client@exemple.test",
      urlSucces: URLS.succes,
      urlAbandon: URLS.abandon,
    });
    expect(sessions[0].libelle).toBe("Le Dernier Métro — séance du 20/11/2026 20:30");
    expect(sessions[0].expireAt.getTime() - MAINTENANT.getTime()).toBe(DUREE_PAGE_PAIEMENT_MS);
  });

  it("ferme d'abord une page de paiement ouverte plus tôt, même si Stripe refuse", async () => {
    const { depot, passerelle, journal } = banc({
      enAttente: [
        { id: "c-0", sessionId: "cs_ancienne" },
        { id: "c-00", sessionId: null },
      ],
      expirationRefusee: true,
    });
    await demarrerPaiement(depot, passerelle, RESERVATION, URLS, MAINTENANT);
    expect(journal.slice(0, 4)).toEqual([
      "expirer cs_ancienne",
      "abandonner c-0",
      "abandonner c-00",
      `ouvrir ${RESERVATION}`,
    ]);
  });

  it.each([
    ["introuvable", "RESERVATION_INTROUVABLE"],
    ["non_modifiable", "RESERVATION_NON_MODIFIABLE"],
    ["expiree", "RESERVATION_EXPIREE"],
  ] as const)(
    "refuse une réservation %s sans créer de page de paiement",
    async (ouverture, code: string) => {
      const { depot, passerelle, sessions } = banc({ ouverture });
      const erreur = await demarrerPaiement(depot, passerelle, RESERVATION, URLS).catch((e) => e);
      expect(erreur).toBeInstanceOf(ErreurApplication);
      expect(erreur.code).toBe(code);
      expect(sessions).toHaveLength(0);
    },
  );
});

const evenement = (type: string, object: Record<string, unknown>) => ({
  id: "evt_1",
  type,
  data: { object },
});
const SESSION_PAYEE = {
  id: "cs_test_1",
  payment_intent: "pi_1",
  amount_total: 2500,
  metadata: { commande_id: "c-1" },
};

describe("traiterEvenement", () => {
  it("confirme la commande puis prélève le paiement autorisé", async () => {
    const { depot, passerelle, journal } = banc();
    const issue = await traiterEvenement(
      depot,
      passerelle,
      evenement("checkout.session.completed", SESSION_PAYEE),
    );
    expect(issue).toBe("confirmee");
    expect(journal).toEqual([
      "debuter evt_1",
      "confirmer c-1 pi_1 2500",
      "capturer pi_1",
      "terminer evt_1",
    ]);
  });

  it("reprend la capture d'une commande déjà confirmée (webhook renvoyé après une erreur)", async () => {
    const { depot, passerelle, journal } = banc({ confirmation: "deja_confirmee" });
    await traiterEvenement(
      depot,
      passerelle,
      evenement("checkout.session.completed", SESSION_PAYEE),
    );
    expect(journal).toContain("capturer pi_1");
  });

  it.each([
    ["places_perdues"],
    ["reservation_close"],
    ["montant_incorrect"],
    ["introuvable"],
  ] as const)(
    "annule l'autorisation sans débiter le client : %s",
    async (confirmation: ResultatConfirmation) => {
      const { depot, passerelle, journal } = banc({ confirmation });
      const issue = await traiterEvenement(
        depot,
        passerelle,
        evenement("checkout.session.completed", SESSION_PAYEE),
      );
      expect(issue).toBe(confirmation);
      expect(journal).toContain("annuler pi_1");
      expect(journal).not.toContain("capturer pi_1");
      expect(journal.at(-1)).toBe("terminer evt_1");
    },
  );

  it("transmet un montant absent comme invalide", async () => {
    const { depot, passerelle, journal } = banc({ confirmation: "montant_incorrect" });
    await traiterEvenement(
      depot,
      passerelle,
      evenement("checkout.session.completed", { ...SESSION_PAYEE, amount_total: null }),
    );
    expect(journal).toContain("confirmer c-1 pi_1 -1");
  });

  it("abandonne la commande quand la page de paiement expire", async () => {
    const { depot, passerelle, journal } = banc();
    const issue = await traiterEvenement(
      depot,
      passerelle,
      evenement("checkout.session.expired", { ...SESSION_PAYEE, payment_intent: null }),
    );
    expect(issue).toBe("abandonnee");
    expect(journal).toEqual(["debuter evt_1", "abandonner c-1", "terminer evt_1"]);
  });

  it("ne traite pas deux fois le même événement", async () => {
    const { depot, passerelle, journal } = banc({ dejaTraite: true });
    const issue = await traiterEvenement(
      depot,
      passerelle,
      evenement("checkout.session.completed", SESSION_PAYEE),
    );
    expect(issue).toBe("deja_traite");
    expect(journal).toEqual(["debuter evt_1"]);
  });

  it("ignore les autres événements et les sessions sans commande", async () => {
    const { depot, passerelle, journal } = banc();
    expect(await traiterEvenement(depot, passerelle, evenement("payment_intent.created", {}))).toBe(
      "ignore",
    );
    expect(
      await traiterEvenement(
        depot,
        passerelle,
        evenement("checkout.session.completed", { ...SESSION_PAYEE, metadata: {} }),
      ),
    ).toBe("ignore");
    expect(
      await traiterEvenement(
        depot,
        passerelle,
        evenement("checkout.session.completed", { amount_total: "beaucoup" }),
      ),
    ).toBe("ignore");
    expect(journal).toEqual([]);
  });

  it("marque traitée une session terminée sans paiement à prélever", async () => {
    const { depot, passerelle, journal } = banc();
    const issue = await traiterEvenement(
      depot,
      passerelle,
      evenement("checkout.session.completed", { ...SESSION_PAYEE, payment_intent: null }),
    );
    expect(issue).toBe("ignore");
    expect(journal).toEqual(["debuter evt_1", "terminer evt_1"]);
  });
});
