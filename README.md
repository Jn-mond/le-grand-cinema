# Le Grand Cinéma

Application web de réservation de places pour le cinéma Le Grand Cinéma : consultation de la programmation, choix des places sur le plan de salle, paiement en ligne, billet avec QR code et contrôle à l'entrée.

Projet réalisé dans le cadre de la formation Studi. Le dépôt est public.

## État du projet

Le dépôt vient d'être initialisé. Il ne contient pas encore de code applicatif : le développement démarre pas à pas, EPIC par EPIC.

## Architecture visée

| Couche | Choix |
|---|---|
| Interface | Application web responsive installable (PWA), React / Next.js |
| API | REST / JSON, monolithe modulaire, hébergée sur Vercel |
| Données | PostgreSQL managé (Supabase, région Union européenne), temps réel pour le plan de salle |
| Paiement | Stripe Checkout (page de paiement hébergée par le prestataire) |

## Backlog

Les EPICs et leurs critères d'acceptation sont suivis dans le tableau Trello public :
https://trello.com/b/hO4uQcbU/1erdepot-le-grand-cinema-backlog-epics

## Branches et contributions

Deux branches permanentes : `main` (versions livrées) et `develop` (intégration).
Le travail se fait sur des branches temporaires nommées selon la convention décrite dans [CONTRIBUTING.md](CONTRIBUTING.md).

## Structure du dépôt

```text
.
├── CONTRIBUTING.md   convention de branches, de commits et de fusion
├── README.md         présentation du projet
└── docs/             documentation (à compléter au fil du projet)
```
