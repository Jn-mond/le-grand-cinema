# Base de données

Scripts PostgreSQL de l'application « Le Grand Cinéma ». La description complète (schéma, dictionnaire, règles, outils) est dans [`docs/modele-de-donnees.md`](../docs/modele-de-donnees.md).

| Dossier | Contenu |
|---|---|
| `migrations/` | Scripts de création et d'évolution, appliqués dans l'ordre des numéros. |
| `seeds/` | Données fictives pour le développement. **Jamais en production.** |
| `tests/` | Tests d'intégrité et de concurrence. |

## Prérequis

PostgreSQL 15 ou plus (testé sur 16) ou un projet Supabase. L'extension `btree_gist` (interdiction des séances qui se chevauchent) est créée par le script et disponible sur Supabase ; la génération d'uuid (`gen_random_uuid`) est intégrée à PostgreSQL depuis la version 13.

## Créer une base de test

```bash
createdb lgc_test
psql lgc_test -v ON_ERROR_STOP=1 -f db/migrations/0001_modele_initial.sql
psql lgc_test -v ON_ERROR_STOP=1 -f db/migrations/0002_vente_guichet.sql
psql lgc_test -v ON_ERROR_STOP=1 -f db/migrations/0003_reference_et_nom_client.sql
psql lgc_test -v ON_ERROR_STOP=1 -f db/migrations/0004_verrou_non_prolongeable.sql
psql lgc_test -v ON_ERROR_STOP=1 -f db/migrations/0005_verrou_multiple_et_securite_api.sql
psql lgc_test -v ON_ERROR_STOP=1 -f db/seeds/jeu_essai.sql
```

Sur Supabase : ouvrir le *SQL Editor*, coller le contenu de chaque fichier et l'exécuter, dans l'ordre des numéros, puis le jeu d'essai.

## Lancer les tests

```bash
psql lgc_test -v ON_ERROR_STOP=1 -f db/tests/contraintes.sql   # 45 tests ; la base n'est pas modifiée
PGDATABASE=lgc_test ./db/tests/concurrence.sh                  # 20 clients, une seule place : 1 seul gagnant
```

`contraintes.sql` affiche un tableau « OK / ÉCHEC » et s'arrête en erreur si un test échoue. Les deux tests se lancent **après** le jeu d'essai.

## Ajouter une évolution

Créer un fichier `migrations/000N_description.sql` (numéro suivant), jamais modifier un fichier déjà appliqué. Voir le § 6 du document de référence.
