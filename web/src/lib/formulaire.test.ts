import { describe, expect, it } from "vitest";
import { ErreurApplication } from "./erreurs";
import { messageSaisie, valeurInitiale, valeursSaisies } from "./formulaire";

describe("valeursSaisies", () => {
  it("garde les champs attendus, ignore les autres et lit les champs multiples", () => {
    const donnees = new FormData();
    donnees.append("titre", "Film");
    donnees.append("$ACTION_ID_abc", "");
    donnees.append("genres", "2");
    donnees.append("genres", "4");
    expect(valeursSaisies(donnees, ["titre", "actif"], ["genres"])).toEqual({
      titre: "Film",
      actif: "",
      genres: ["2", "4"],
    });
  });

  it("ignore un fichier envoyé à la place d'un texte", () => {
    const donnees = new FormData();
    donnees.append("titre", new Blob(["x"]));
    donnees.append("genres", new Blob(["x"]));
    expect(valeursSaisies(donnees, ["titre"], ["genres"])).toEqual({ titre: "", genres: [] });
  });
});

describe("valeurInitiale", () => {
  it("reprend la saisie refusée, même vide", () => {
    expect(valeurInitiale({ titre: "Film" }, "titre", "Ancien")).toBe("Film");
    expect(valeurInitiale({ titre: "" }, "titre", "Ancien")).toBe("");
  });

  it("garde la valeur par défaut sans saisie ou pour un champ multiple", () => {
    expect(valeurInitiale(undefined, "titre", "Ancien")).toBe("Ancien");
    expect(valeurInitiale({ genres: ["1"] }, "genres", "")).toBe("");
  });
});

describe("messageSaisie", () => {
  it("affiche le premier problème d'une saisie invalide", () => {
    const erreur = new ErreurApplication("REQUETE_INVALIDE", "Données invalides", {
      erreurs: [{ champ: "titre", message: "Le titre est obligatoire" }],
    });
    expect(messageSaisie(erreur)).toBe("Le titre est obligatoire");
  });

  it("garde le message de l'erreur dans les autres cas", () => {
    expect(messageSaisie(new ErreurApplication("FILM_INTROUVABLE", "Film introuvable"))).toBe(
      "Film introuvable",
    );
    expect(messageSaisie(new ErreurApplication("REQUETE_INVALIDE", "Données invalides", {}))).toBe(
      "Données invalides",
    );
    expect(
      messageSaisie(
        new ErreurApplication("REQUETE_INVALIDE", "Données invalides", { erreurs: [] }),
      ),
    ).toBe("Données invalides");
    expect(
      messageSaisie(
        new ErreurApplication("REQUETE_INVALIDE", "Données invalides", { erreurs: [{}] }),
      ),
    ).toBe("Données invalides");
  });
});
