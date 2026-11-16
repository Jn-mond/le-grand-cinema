import { describe, expect, it } from "vitest";
import { ErreurApplication } from "../../lib/erreurs";
import { valider } from "../reservations/schemas";
import {
  enregistrerFilm,
  lireFormulaireFilm,
  messageSaisie,
  schemaFilm,
  type DepotGestionFilms,
  type FilmSaisi,
} from "./gestion";

const SAISIE = {
  titre: "  Le Dernier Métro ",
  titreOriginal: "",
  dureeMinutes: "131",
  ageMinimum: "12",
  dateSortie: "1980-09-17",
  synopsis: "",
  afficheUrl: "https://exemple.test/affiche.jpg",
  actif: "on",
  genres: ["3", "1", "3"],
};

function depotEnMemoire(resultat: number | "introuvable" | "duree_verrouillee" = 7) {
  const appels: { film: FilmSaisi; id: number | null }[] = [];
  const depot: DepotGestionFilms = {
    async genresExistants(ids) {
      return ids.filter((id) => id <= 5);
    },
    async enregistrer(film, id) {
      appels.push({ film, id });
      return resultat;
    },
  };
  return { depot, appels };
}

describe("schemaFilm", () => {
  it("nettoie la saisie : espaces, champs vides, nombres, genres sans doublon et triés", () => {
    const film = valider(schemaFilm, SAISIE);
    expect(film).toEqual({
      titre: "Le Dernier Métro",
      titreOriginal: null,
      dureeMinutes: 131,
      ageMinimum: 12,
      dateSortie: "1980-09-17",
      synopsis: null,
      afficheUrl: "https://exemple.test/affiche.jpg",
      actif: true,
      genres: [1, 3],
    });
  });

  it("considère une case « actif » non cochée comme un film inactif", () => {
    const { actif, ...sansActif } = SAISIE;
    void actif;
    expect(valider(schemaFilm, sansActif).actif).toBe(false);
  });

  it("enregistre comme absents la date de sortie et l'affiche laissées vides", () => {
    const film = valider(schemaFilm, { ...SAISIE, dateSortie: " ", afficheUrl: "" });
    expect(film.dateSortie).toBe(null);
    expect(film.afficheUrl).toBe(null);
  });

  it.each([
    [{ titre: "   " }, "Le titre est obligatoire"],
    [{ dureeMinutes: "deux heures" }, "Durée invalide"],
    [{ dureeMinutes: "0" }, "Durée : de 1 à 600 minutes"],
    [{ dureeMinutes: "90.5" }, "La durée est un nombre entier de minutes"],
    [{ ageMinimum: "14" }, "Âge minimal invalide"],
    [{ dateSortie: "2026-02-31" }, "Date de sortie invalide"],
    [{ dateSortie: "17/09/1980" }, "Date de sortie invalide"],
    [{ afficheUrl: "http://exemple.test/a.jpg" }, "L’affiche doit être une adresse https"],
  ])("refuse une saisie invalide (%o)", (modification: Partial<typeof SAISIE>, message: string) => {
    const resultat = schemaFilm.safeParse({ ...SAISIE, ...modification });
    expect(resultat.success).toBe(false);
    expect(resultat.error?.issues[0].message).toBe(message);
  });
});

describe("lireFormulaireFilm", () => {
  it("garde tous les genres cochés, pas seulement le dernier", () => {
    const donnees = new FormData();
    donnees.append("titre", "Film");
    donnees.append("genres", "2");
    donnees.append("genres", "4");
    expect(lireFormulaireFilm(donnees)).toEqual({ titre: "Film", genres: ["2", "4"] });
  });
});

describe("enregistrerFilm", () => {
  const film = valider(schemaFilm, SAISIE);

  it("crée un film quand aucun identifiant n'est donné", async () => {
    const { depot, appels } = depotEnMemoire(42);
    await expect(enregistrerFilm(depot, film)).resolves.toBe(42);
    expect(appels).toEqual([{ film, id: null }]);
  });

  it("modifie le film demandé", async () => {
    const { depot, appels } = depotEnMemoire(7);
    await expect(enregistrerFilm(depot, film, 7)).resolves.toBe(7);
    expect(appels[0].id).toBe(7);
  });

  it("refuse un genre inconnu sans rien enregistrer", async () => {
    const { depot, appels } = depotEnMemoire();
    const erreur = await enregistrerFilm(depot, { ...film, genres: [1, 9] }).catch((e) => e);
    expect(erreur).toBeInstanceOf(ErreurApplication);
    expect(erreur.code).toBe("GENRE_INTROUVABLE");
    expect(erreur.details).toEqual({ genres: [9] });
    expect(appels).toHaveLength(0);
  });

  it("accepte un film sans genre sans interroger les genres", async () => {
    const { depot } = depotEnMemoire(3);
    await expect(enregistrerFilm(depot, { ...film, genres: [] })).resolves.toBe(3);
  });

  it("signale un film introuvable", async () => {
    const { depot } = depotEnMemoire("introuvable");
    await expect(enregistrerFilm(depot, film, 99)).rejects.toMatchObject({
      code: "FILM_INTROUVABLE",
    });
  });

  it("refuse de changer la durée d'un film dont des séances à venir dépendent", async () => {
    const { depot } = depotEnMemoire("duree_verrouillee");
    const erreur = await enregistrerFilm(depot, film, 7).catch((e) => e);
    expect(erreur.code).toBe("FILM_AVEC_SEANCES");
    expect(erreur.statut).toBe(409);
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
