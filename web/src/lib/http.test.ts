import { afterEach, describe, expect, it, vi } from "vitest";
import { ErreurApplication } from "./erreurs";
import { lireCorpsJson, reponseErreur, reponseJson, traiterRequete } from "./http";

describe("reponseJson", () => {
  it("renvoie les données avec le statut demandé", async () => {
    const reponse = reponseJson({ ok: true }, 201);
    expect(reponse.status).toBe(201);
    expect(await reponse.json()).toEqual({ ok: true });
  });
});

describe("reponseErreur", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("convertit une erreur attendue en problem+json avec son statut et ses détails", async () => {
    const reponse = reponseErreur(
      new ErreurApplication("PLACES_INDISPONIBLES", "Places prises", { placesRefusees: [3] }),
    );
    expect(reponse.status).toBe(409);
    expect(reponse.headers.get("Content-Type")).toBe("application/problem+json");
    expect(await reponse.json()).toEqual({
      type: "about:blank",
      title: "Places prises",
      status: 409,
      code: "PLACES_INDISPONIBLES",
      placesRefusees: [3],
    });
  });

  it("masque le détail d'une erreur inattendue et la journalise", async () => {
    const journal = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const reponse = reponseErreur(new Error("mot de passe de la base dans le message"));
    expect(reponse.status).toBe(500);
    const corps = (await reponse.json()) as Record<string, unknown>;
    expect(corps.code).toBe("ERREUR_INTERNE");
    expect(JSON.stringify(corps)).not.toContain("mot de passe");
    expect(journal).toHaveBeenCalledOnce();
  });
});

describe("traiterRequete", () => {
  it("renvoie la réponse du traitement quand tout va bien", async () => {
    const reponse = await traiterRequete(async () => reponseJson({ ok: true }));
    expect(reponse.status).toBe(200);
  });

  it("transforme une erreur levée en réponse d'erreur", async () => {
    const reponse = await traiterRequete(async () => {
      throw new ErreurApplication("SEANCE_INTROUVABLE", "Séance introuvable");
    });
    expect(reponse.status).toBe(404);
  });
});

describe("lireCorpsJson", () => {
  it("lit un corps JSON valide", async () => {
    const requete = new Request("http://test/api", { method: "POST", body: '{"a":1}' });
    expect(await lireCorpsJson(requete)).toEqual({ a: 1 });
  });

  it("refuse un corps mal formé avec REQUETE_INVALIDE", async () => {
    const requete = new Request("http://test/api", { method: "POST", body: "{pas du json" });
    await expect(lireCorpsJson(requete)).rejects.toMatchObject({ code: "REQUETE_INVALIDE" });
  });
});
