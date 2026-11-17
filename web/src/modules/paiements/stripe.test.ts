import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { ErreurStripe, PasserelleStripe, verifierSignature } from "./stripe";

interface Appel {
  url: string;
  entetes: Record<string, string>;
  corps: URLSearchParams;
}

/** Remplace fetch : enregistre les requêtes et renvoie la réponse prévue. */
function faussesRequetes(statut = 200, reponse: unknown = {}) {
  const appels: Appel[] = [];
  const envoyer = (async (url: string, init: RequestInit) => {
    appels.push({
      url,
      entetes: init.headers as Record<string, string>,
      corps: new URLSearchParams(String(init.body)),
    });
    return new Response(typeof reponse === "string" ? reponse : JSON.stringify(reponse), {
      status: statut,
    });
  }) as unknown as typeof fetch;
  return { envoyer, appels };
}

const DEMANDE = {
  commandeId: "c-1",
  reservationId: "r-1",
  libelle: "Le Dernier Métro — séance du 20/11/2026 20:30",
  quantite: 2,
  prixUnitaireCentimes: 1250,
  email: "client@exemple.test",
  urlSucces: "https://site.test/reservations/r-1?paiement=succes",
  urlAbandon: "https://site.test/reservations/r-1?paiement=abandon",
  expireAt: new Date("2026-11-20T17:31:00Z"),
};

describe("PasserelleStripe", () => {
  it("crée une page de paiement à capture différée, sans payer deux fois la même commande", async () => {
    const { envoyer, appels } = faussesRequetes(200, { id: "cs_1", url: "https://stripe/cs_1" });
    const session = await new PasserelleStripe("sk_test_x", envoyer).creerSession(DEMANDE);
    expect(session).toEqual({ id: "cs_1", url: "https://stripe/cs_1" });
    const [appel] = appels;
    expect(appel.url).toBe("https://api.stripe.com/v1/checkout/sessions");
    expect(appel.entetes.Authorization).toBe("Bearer sk_test_x");
    expect(appel.entetes["Idempotency-Key"]).toBe("commande-c-1");
    expect(appel.corps.get("payment_intent_data[capture_method]")).toBe("manual");
    expect(appel.corps.get("line_items[0][price_data][unit_amount]")).toBe("1250");
    expect(appel.corps.get("line_items[0][quantity]")).toBe("2");
    expect(appel.corps.get("metadata[commande_id]")).toBe("c-1");
    expect(appel.corps.get("expires_at")).toBe(String(Date.UTC(2026, 10, 20, 17, 31) / 1000));
    expect(appel.corps.get("customer_email")).toBe("client@exemple.test");
  });

  it("refuse une réponse de Stripe sans adresse de paiement", async () => {
    const { envoyer } = faussesRequetes(200, { id: "cs_1" });
    const erreur = await new PasserelleStripe("sk_test_x", envoyer)
      .creerSession(DEMANDE)
      .catch((e) => e);
    expect(erreur).toBeInstanceOf(ErreurStripe);
    expect(erreur.statut).toBe(502);
  });

  it("expire, capture et annule par les adresses de l'API", async () => {
    const { envoyer, appels } = faussesRequetes();
    const stripe = new PasserelleStripe("sk_test_x", envoyer);
    await stripe.expirerSession("cs_1");
    await stripe.capturer("pi_1");
    await stripe.annuler("pi_1");
    expect(appels.map((a) => a.url.replace("https://api.stripe.com/v1/", ""))).toEqual([
      "checkout/sessions/cs_1/expire",
      "payment_intents/pi_1/capture",
      "payment_intents/pi_1/cancel",
    ]);
    expect(appels[1].entetes["Idempotency-Key"]).toBe(undefined);
  });

  it("transmet le message et le code d'une erreur Stripe", async () => {
    const { envoyer } = faussesRequetes(400, {
      error: { message: "No such checkout.session", code: "resource_missing" },
    });
    const erreur = await new PasserelleStripe("sk_test_x", envoyer)
      .expirerSession("cs_x")
      .catch((e) => e);
    expect(erreur).toBeInstanceOf(ErreurStripe);
    expect(erreur.message).toBe("No such checkout.session");
    expect(erreur.code).toBe("resource_missing");
  });

  it("donne un message par défaut quand la réponse d'erreur est illisible", async () => {
    const { envoyer } = faussesRequetes(503, "Service Unavailable");
    const erreur = await new PasserelleStripe("sk_test_x", envoyer)
      .capturer("pi_1")
      .catch((e) => e);
    expect(erreur.message).toBe("Stripe : erreur 503");
    expect(erreur.statut).toBe(503);
  });

  it("accepte une capture ou une annulation déjà faite (webhook rejoué)", async () => {
    const dejaCapture = faussesRequetes(400, {
      error: { code: "payment_intent_unexpected_state", payment_intent: { status: "succeeded" } },
    });
    await expect(
      new PasserelleStripe("sk_test_x", dejaCapture.envoyer).capturer("pi_1"),
    ).resolves.toBe(undefined);
    const dejaAnnule = faussesRequetes(400, {
      error: { code: "payment_intent_unexpected_state", payment_intent: { status: "canceled" } },
    });
    await expect(
      new PasserelleStripe("sk_test_x", dejaAnnule.envoyer).annuler("pi_1"),
    ).resolves.toBe(undefined);
  });

  it("signale une capture impossible (autorisation annulée ou expirée)", async () => {
    const { envoyer } = faussesRequetes(400, {
      error: { code: "payment_intent_unexpected_state", payment_intent: { status: "canceled" } },
    });
    const erreur = await new PasserelleStripe("sk_test_x", envoyer)
      .capturer("pi_1")
      .catch((e) => e);
    expect(erreur).toBeInstanceOf(ErreurStripe);
    expect(erreur.statutPaiement).toBe("canceled");
  });

  it("laisse passer une erreur réseau", async () => {
    const envoyer = (async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;
    const erreur = await new PasserelleStripe("sk_test_x", envoyer).annuler("pi_1").catch((e) => e);
    expect(erreur).toBeInstanceOf(TypeError);
  });
});

describe("verifierSignature", () => {
  const SECRET = "whsec_test_secret";
  const CORPS = JSON.stringify({
    id: "evt_1",
    type: "checkout.session.completed",
    data: { object: { id: "cs_1" } },
  });
  const T = 1_800_000_000;
  const signer = (corps: string, t = T, secret = SECRET) =>
    createHmac("sha256", secret).update(`${t}.${corps}`).digest("hex");

  it("accepte un événement signé avec le secret du webhook", () => {
    const evenement = verifierSignature(CORPS, `t=${T},v1=${signer(CORPS)}`, SECRET, T + 10);
    expect(evenement?.id).toBe("evt_1");
    expect(evenement?.type).toBe("checkout.session.completed");
  });

  it("accepte plusieurs signatures (changement de secret en cours)", () => {
    const entete = `t=${T}, v1=${signer(CORPS, T, "ancien")}, v1=${signer(CORPS)}, v0=abc`;
    expect(verifierSignature(CORPS, entete, SECRET, T)).not.toBe(null);
  });

  it.each([
    ["sans en-tête", null, T],
    [
      "signature d'un autre secret",
      `t=${T},v1=${createHmac("sha256", "autre").update(`${T}.${CORPS}`).digest("hex")}`,
      T,
    ],
    ["signature tronquée", `t=${T},v1=abc`, T],
    ["sans signature v1", `t=${T}`, T],
    ["signature v1 vide", `t=${T},v1`, T],
    ["sans horodatage", "v1=abc", T],
    ["message trop ancien (rejeu)", `t=${T},v1=SIGNATURE`, T + 301],
    ["message daté du futur", `t=${T},v1=SIGNATURE`, T - 301],
  ])("refuse : %s", (_cas: string, entete: string | null, maintenant: number) => {
    const avecSignature = entete?.replace("SIGNATURE", signer(CORPS)) ?? null;
    expect(verifierSignature(CORPS, avecSignature, SECRET, maintenant)).toBe(null);
  });

  it("refuse un corps modifié après signature", () => {
    const modifie = CORPS.replace("evt_1", "evt_2");
    expect(verifierSignature(modifie, `t=${T},v1=${signer(CORPS)}`, SECRET, T)).toBe(null);
  });

  it("refuse quand le secret n'est pas configuré", () => {
    expect(verifierSignature(CORPS, `t=${T},v1=${signer(CORPS, T, "")}`, "", T)).toBe(null);
  });

  it("refuse un corps signé qui n'est pas un événement Stripe", () => {
    for (const corps of ["pas du JSON", JSON.stringify({ id: "evt_1" })]) {
      expect(verifierSignature(corps, `t=${T},v1=${signer(corps)}`, SECRET, T)).toBe(null);
    }
  });
});
