# Qualité du code

Ce document décrit les outils qui contrôlent la qualité du code, quand ils s'exécutent et comment lire leurs résultats.

## Outils en place

| Outil | Ce qu'il contrôle | Où il s'exécute |
|---|---|---|
| TypeScript (mode strict) | Erreurs de types | `npm run build`, éditeur |
| ESLint (configuration Next.js) | Erreurs probables, mauvaises pratiques React et Next.js | `npm run lint` |
| Prettier | Formatage uniforme (une seule présentation du code) | `npm run format:verifier` |
| Vitest et couverture V8 | Tests unitaires et part du code exécutée par les tests | `npm run test:couverture` |
| Tests SQL | Règles d'intégrité de la base, concurrence sur le verrou de places | `db/tests/` |
| SonarQube Cloud | Bogues, vulnérabilités, failles de sécurité potentielles, duplication, dette technique, couverture | Job `sonar` du workflow |
| GitHub Actions | Lance tout ce qui précède à chaque Pull Request, et vérifie le nom de la branche | `.github/workflows/ci.yml` |

Une Pull Request ne se fusionne que si tous les jobs sont verts. Pour l'imposer, activer dans GitHub *Settings > Branches* (ou *Rules*) la règle « Require status checks to pass » sur `develop` et `main`.

## Brancher SonarQube Cloud (une seule fois)

1. Se connecter à SonarQube Cloud (sonarcloud.io) avec son compte GitHub et créer l'organisation à partir du compte GitHub.
2. Importer le dépôt `le-grand-cinema` (*Analyze new project*).
3. Dans *Administration > Analysis Method*, **désactiver l'analyse automatique** : l'analyse est lancée par GitHub Actions, avec le rapport de couverture. Les deux modes ne peuvent pas fonctionner en même temps.
4. Créer un jeton (*My Account > Security*) et l'enregistrer dans GitHub : *Settings > Secrets and variables > Actions > New repository secret*, nom `SONAR_TOKEN`.
5. Vérifier que `sonar.organization` et `sonar.projectKey` dans `sonar-project.properties` correspondent aux valeurs affichées par SonarQube Cloud (*Information* du projet).

Sans le secret `SONAR_TOKEN`, le job `sonar` affiche un avertissement et n'échoue pas : le reste de la vérification continue de fonctionner.

## Couverture de tests

- Rapport lisible : `web/coverage/index.html` après `npm run test:couverture`.
- La couverture mesure la logique métier (`src/modules`) et les utilitaires (`src/lib`). Les routes HTTP et l'accès à Supabase sont du code d'infrastructure sans logique propre : ils sont exclus du calcul, vérifiés par le build et par les tests SQL de la base. Ce choix est déclaré dans `vitest.config.mts` et `sonar-project.properties` pour rester transparent.

## Corriger un bogue

Chaque bogue suit la même démarche, consignée dans [`correctifs.md`](correctifs.md) : symptôme, recherche de la cause, reproduction, correction, test de non-régression, validation par la vérification automatique.
