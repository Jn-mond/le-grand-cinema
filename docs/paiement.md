# Paiement en ligne (E4)

Le paiement passe par **Stripe Checkout**, la page de paiement hébergée par Stripe, en **mode test** : aucune carte réelle, aucun argent réel. L'application ne voit jamais les données de carte ; elle ne stocke que les identifiants Stripe de la session et du paiement (`commande.prestataire_session_id`, `commande.prestataire_paiement_id`).

## Parcours

1. Le spectateur bloque ses places pendant 10 minutes (E3), puis clique sur **Payer**.
2. Le serveur ouvre une commande (`ouvrir_commande()`, migration 0008) : montant = nombre de places × prix de la séance, places fixées dans la commande. Il crée la session Stripe, avec la **capture différée** (`capture_method=manual`) : la carte est seulement autorisée, pas encore débitée. Le navigateur est redirigé vers la page Stripe.
3. Le spectateur paie ou abandonne. Stripe le renvoie sur `/reservations/{id}?paiement=succes` ou `?paiement=abandon`.
4. Stripe prévient le serveur par **webhook** (`POST /api/paiements/webhook`). La signature de chaque message est vérifiée (secret `STRIPE_WEBHOOK_SECRET`, tolérance de 5 minutes contre le rejeu) avant toute lecture.
   - `checkout.session.completed` : `confirmer_commande()` crée les billets si les places sont toujours disponibles, puis le serveur **capture** le paiement. Sinon, il **annule l'autorisation** : le client n'est pas débité.
   - `checkout.session.expired` : la commande passe à « abandonnée ».
5. La page de retour affiche l'état : paiement confirmé (places et total), confirmation en cours (la page se relit toute seule, le webhook arrivant parfois après le client), paiement abandonné (reprise possible tant que les places sont bloquées), paiement non abouti, réservation expirée.

```
Navigateur ──Payer──▶ Serveur ──ouvrir_commande()──▶ PostgreSQL
    │                    └──créer la session (capture différée)──▶ Stripe
    └──────────── page de paiement hébergée ─────────────────────▶ Stripe
Stripe ──webhook signé──▶ Serveur ──confirmer_commande()──▶ PostgreSQL (billets, en une transaction)
                            ├── confirmée : capture ─────────▶ Stripe (client débité)
                            └── places perdues : annulation ─▶ Stripe (rien n'est débité)
```

## Paiement arrivé après l'expiration du verrou

Le verrou dure 10 minutes ; une page Stripe reste ouverte au moins 30 minutes (minimum imposé par Stripe). Un paiement peut donc arriver après la fin du blocage. `confirmer_commande()` traite ce cas dans une seule transaction :

| Situation à la confirmation | Résultat |
|---|---|
| Verrou encore actif | Billets créés, paiement capturé. |
| Verrou expiré, place restée libre | Billets créés, paiement capturé : personne n'est lésé. |
| Verrou expiré, place bloquée ou achetée par un autre client | Aucun billet, commande « échouée », réservation « expirée », **autorisation annulée** : le client n'est pas débité et la page lui explique pourquoi. |
| Deux confirmations au même instant pour la même place | L'index unique `billet_place_vendue_une_fois` laisse passer la première ; la seconde tombe dans le cas précédent. |

La capture différée évite le remboursement : tant que les billets ne sont pas créés, l'argent n'a pas quitté le compte du client. Une autorisation par carte reste valable environ 7 jours, bien plus que le temps de traitement d'un webhook.

Autres protections :
- **Webhook reçu deux fois** : chaque événement est enregistré dans `evenement_paiement` et n'est marqué traité qu'à la fin ; une commande déjà payée répond `deja_confirmee`, sans nouveau billet (test T58). Capture et annulation déjà faites sont acceptées sans erreur.
- **Erreur pendant le traitement** : le webhook répond 500 ; Stripe le renvoie plus tard (jusqu'à trois jours en mode réel, quelques heures en mode test) et le traitement reprend là où il s'est arrêté.
- **Montant différent** de la commande : refusé, autorisation annulée (test T62).
- **Deux pages de paiement pour la même réservation** (double clic, retour arrière) : la nouvelle demande ferme l'ancienne page ; si les deux sont réglées malgré tout, la seconde est refusée et annulée (test T63).
- **Clé secrète** : `STRIPE_SECRET_KEY` n'est lue que côté serveur (`lib/stripe-serveur.ts`, module `server-only`) et n'a jamais de préfixe `NEXT_PUBLIC_`. Aucune clé publique Stripe n'est nécessaire.

## Mettre en place (mode test)

1. **Clé secrète de test** : tableau de bord Stripe (sandbox) > *Développeurs* > *Clés API* > clé secrète `sk_test_…`. La copier dans `web/.env.local` (`STRIPE_SECRET_KEY=`), jamais dans le dépôt.
2. **Migration** : exécuter `db/migrations/0008_paiement.sql` dans le *SQL Editor* de Supabase.
3. **Webhook en local** avec la [Stripe CLI](https://docs.stripe.com/stripe-cli) :
   ```bash
   stripe login
   stripe listen --forward-to localhost:3000/api/paiements/webhook \
     --events checkout.session.completed,checkout.session.expired
   ```
   La commande affiche un secret `whsec_…` : le copier dans `web/.env.local` (`STRIPE_WEBHOOK_SECRET=`), relancer `npm run dev`.
4. **Webhook du site en ligne** : *Développeurs* > *Webhooks* > *Ajouter une destination*, adresse `https://le-grand-cinema.vercel.app/api/paiements/webhook`, événements `checkout.session.completed` et `checkout.session.expired`. Le secret de signature de cette destination (différent de celui de la CLI) et la clé `sk_test_…` vont dans Vercel > *Settings* > *Environment Variables*, puis on redéploie.

## Recette

| Essai | Carte de test | Attendu |
|---|---|---|
| Paiement accepté | `4242 4242 4242 4242`, date future, CVC quelconque | « Paiement confirmé », places vendues sur le plan, paiement « Réussi » dans Stripe |
| Carte refusée | `4000 0000 0000 0002` | Stripe affiche le refus sur sa page ; aucune commande payée |
| Abandon | bouton retour de la page Stripe | « Paiement abandonné », rien n'est débité, bouton pour reprendre |
| Paiement tardif | bloquer, ouvrir la page Stripe, attendre plus de 10 minutes, faire bloquer la même place par un autre navigateur, puis payer | « Paiement non abouti », autorisation « Annulée » dans Stripe |

## Limites

- **E-mail de confirmation** : non envoyé dans cette version (pas de domaine d'envoi vérifié). Les billets sont consultables sur la page de retour et dans l'espace client.
- **Tâche de rapprochement** : si un webhook n'arrivait jamais (destination mal configurée), la commande resterait « en attente » ; Stripe signale ces échecs dans son tableau de bord. Une tâche planifiée qui relit les sessions ouvertes est prévue avec la tâche de nettoyage des verrous.
