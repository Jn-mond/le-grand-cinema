import { describe, expect, it } from "vitest";
import { erreurLevee } from "../../test/utilitaires";
import {
  schemaCreationReservation,
  schemaIdentifiantReservation,
  schemaIdentifiantSeance,
  schemaVerrouillage,
  valider,
} from "./schemas";

describe("schemaCreationReservation", () => {
  it("accepte une demande valide et nettoie les espaces", () => {
    expect(
      valider(schemaCreationReservation, {
        seanceId: 1,
        email: "  alice@exemple.test ",
        nomClient: " Alice ",
      }),
    ).toEqual({ seanceId: 1, email: "alice@exemple.test", nomClient: "Alice" });
  });

  it("refuse une adresse e-mail invalide en indiquant le champ", () => {
    const erreur = erreurLevee(() =>
      valider(schemaCreationReservation, { seanceId: 1, email: "pas-un-email" }),
    );
    expect(erreur).toMatchObject({
      code: "REQUETE_INVALIDE",
      details: { erreurs: [{ champ: "email", message: "Adresse e-mail invalide" }] },
    });
  });

  it("refuse un champ inconnu (protection contre l'envoi de données inattendues)", () => {
    const erreur = erreurLevee(() =>
      valider(schemaCreationReservation, {
        seanceId: 1,
        email: "a@exemple.test",
        statut: "confirmee",
      }),
    );
    expect(erreur).toMatchObject({ code: "REQUETE_INVALIDE" });
  });
});

describe("schemaVerrouillage", () => {
  it("accepte une liste d'identifiants de places", () => {
    expect(valider(schemaVerrouillage, { placeIds: [1, 2] })).toEqual({ placeIds: [1, 2] });
  });

  it("refuse une liste vide ou des identifiants non entiers", () => {
    expect(erreurLevee(() => valider(schemaVerrouillage, { placeIds: [] }))).toMatchObject({
      code: "REQUETE_INVALIDE",
    });
    expect(erreurLevee(() => valider(schemaVerrouillage, { placeIds: [1.5] }))).toMatchObject({
      code: "REQUETE_INVALIDE",
    });
  });
});

describe("identifiants dans l'URL", () => {
  it("convertit l'identifiant de séance reçu en texte", () => {
    expect(valider(schemaIdentifiantSeance, "42")).toBe(42);
  });

  it("refuse un identifiant de séance non numérique", () => {
    expect(erreurLevee(() => valider(schemaIdentifiantSeance, "abc"))).toMatchObject({
      code: "REQUETE_INVALIDE",
    });
  });

  it("refuse un identifiant de réservation qui n'est pas un uuid", () => {
    expect(erreurLevee(() => valider(schemaIdentifiantReservation, "123"))).toMatchObject({
      code: "REQUETE_INVALIDE",
    });
  });
});
