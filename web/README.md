# Application web — Le Grand Cinéma

Application Next.js (App Router, TypeScript strict) : interface de réservation et API REST. La base de données et sa documentation sont dans [`../db`](../db) et [`../docs`](../docs).

## Démarrer

```bash
npm install
cp .env.example .env.local   # puis renseigner les valeurs (jamais commitées)
npm run dev                  # http://localhost:3000
```

## Commandes

| Commande | Rôle |
|---|---|
| `npm run dev` | Serveur de développement |
| `npm run build` | Compilation de production (vérifie aussi les types TypeScript) |
| `npm run lint` | Analyse statique ESLint (règles Next.js et TypeScript) |
| `npm run format` / `npm run format:verifier` | Formate le code avec Prettier / vérifie qu'il est formaté |
| `npm test` | Tests unitaires (Vitest) |
| `npm run test:couverture` | Tests unitaires et rapport de couverture (`coverage/index.html`, `coverage/lcov.info`) |

Ces commandes sont aussi lancées automatiquement à chaque Pull Request (`.github/workflows/ci.yml`). Les outils de qualité sont décrits dans [`../docs/qualite.md`](../docs/qualite.md).
