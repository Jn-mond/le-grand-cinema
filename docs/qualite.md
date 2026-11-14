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

**Ce que le plan gratuit analyse.** SonarQube Cloud gratuit n'analyse que la branche principale (`main`) et les Pull Requests. Les envois sur `develop` sont reçus mais pas affichés (« Not analyzed »), et une Pull Request qui vise `develop` peut apparaître sans résultat, faute de branche de référence analysée. Le tableau de bord qui fait foi est donc celui de `main`, mis à jour à chaque version publiée.

**Jeton.** Le jeton personnel `SONAR_TOKEN` expire au bout de 90 jours. À l'expiration, l'analyse Sonar s'arrête (le reste de la vérification continue) : générer un nouveau jeton et mettre à jour le secret GitHub. Les jetons d'organisation, plus sûrs car non rattachés à une personne, sont réservés aux plans payants.

## Première analyse SonarQube Cloud et traitement

La première analyse a relevé 7 problèmes (4 de sécurité, 3 de fiabilité, aucun de maintenabilité, 0 % de duplication). Chacun a été examiné puis corrigé dans la branche `fix/sonar-securite-fiabilite` :

| Fichier | Problème signalé | Risque réel | Correction |
|---|---|---|---|
| `.github/workflows/ci.yml` | Action tierce référencée par un tag (sécurité, élevée) | Un tag peut être déplacé vers un autre code : si le compte de l'éditeur était compromis, du code malveillant s'exécuterait avec le jeton Sonar. | Action figée par l'empreinte complète de son commit (`v8.5.0`). Les actions officielles de GitHub restent référencées par version majeure. |
| `.github/workflows/ci.yml` | `npm ci` sans `--ignore-scripts` (sécurité, moyenne) | Un paquet piégé pourrait exécuter un script à l'installation. | `npm ci --ignore-scripts`. |
| `web/public/docs-api.html` (×2) | Fichiers du CDN chargés sans contrôle d'intégrité (sécurité, faible) | Si le CDN était compromis, un script modifié s'exécuterait sur le domaine de l'application. | Attributs `integrity` (empreinte SHA-384, vérifiée contre la version officielle) et `crossorigin="anonymous"` : le navigateur refuse tout fichier modifié. |
| `db/tests/concurrence.sh` (×2) | `[ ]` au lieu de `[[ ]]` en Bash (fiabilité) | Faible ici (variables entre guillemets), mais `[[ ]]` évite des erreurs de découpage et de motifs. | Condition réécrite avec `[[ … && … ]]`. |
| `web/src/modules/reservations/schemas.ts` | Expression régulière à retour arrière super-linéaire (fiabilité, moyenne) | **Réel** : déni de service possible par une seule requête. | Correctif C2, détaillé dans [`correctifs.md`](correctifs.md). |

Le périmètre analysé (`sonar.sources`) couvre tout le dépôt : application, workflow, scripts SQL et shell, page de documentation. Réduire ce périmètre aurait fait disparaître les problèmes sans les corriger.

### Résultat après correction (version 0.1.1, branche `main`)

| Indicateur | Première analyse | Après la version 0.1.1 |
|---|---|---|
| Quality Gate | Non calculé | **Passed** |
| Sécurité | C (4 problèmes) | **A (0)** |
| Fiabilité | A (3 problèmes) | **A (0)** |
| Maintenabilité | A (0) | A (0) |
| Couverture | Non mesurée | **97,8 %** |
| Duplication | 0,0 % | 0,0 % |

Les 7 problèmes sont passés à l'état « corrigé » à l'analyse suivante, sans être marqués comme « acceptés » : chacun a été réellement corrigé. La couverture affichée par Sonar (97,8 %) diffère légèrement de celle de Vitest (100 % du code métier), car Sonar mesure sur l'ensemble des fichiers analysés.

## Couverture de tests

- Rapport lisible : `web/coverage/index.html` après `npm run test:couverture`.
- La couverture mesure la logique métier (`src/modules`) et les utilitaires (`src/lib`). Les routes HTTP et l'accès à Supabase sont du code d'infrastructure sans logique propre : ils sont exclus du calcul, vérifiés par le build et par les tests SQL de la base. Ce choix est déclaré dans `vitest.config.mts` et `sonar-project.properties` pour rester transparent.

## Corriger un bogue

Chaque bogue suit la même démarche, consignée dans [`correctifs.md`](correctifs.md) : symptôme, recherche de la cause, reproduction, correction, test de non-régression, validation par la vérification automatique.
