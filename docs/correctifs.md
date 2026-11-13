# Journal des correctifs

Ce document garde la trace des bogues identifiés, de leur cause, de la façon dont ils ont été reproduits, corrigés et validés. Un correctif n'est considéré comme terminé que lorsqu'un test automatique le protège.

## C1 — Le verrou de place pouvait être prolongé indéfiniment (E3)

| | |
|---|---|
| **Où** | Base de données, fonction `poser_verrou()` (migration 0001), utilisée par la réservation. |
| **Gravité** | Élevée : elle permet de bloquer des places sans jamais payer. |
| **Statut** | Corrigé par la migration `0004_verrou_non_prolongeable.sql`. |

### Symptôme
La règle métier est « une place est bloquée 10 minutes au maximum pendant le paiement » (EPIC E3). Or un client dont le navigateur rappelle l'API de verrou en boucle, ou un utilisateur malveillant, pouvait garder des places bloquées sans limite : chaque appel remettait le compteur à 10 minutes. Pendant un festival, quelques réservations suffisaient à rendre des séances complètes sur le site sans qu'aucune place soit réellement vendue.

### Recherche de la cause
Relecture de la clause `ON CONFLICT … DO UPDATE` de `poser_verrou()` : elle acceptait la mise à jour du verrou dans deux cas, « le verrou a expiré » et « le verrou appartient déjà à la même réservation ». Dans le second cas, `expire_at` était recalculé à `now() + 10 minutes`. Le test T12 vérifiait même que ce renouvellement fonctionnait : le comportement était testé, mais la règle métier ne l'était pas.

### Reproduction
```sql
select poser_verrou('<réservation>', 7);                                  -- verrou posé, échéance dans 10 min
update verrou_place set expire_at = now() + interval '1 minute' where place_id = 7;   -- 9 minutes écoulées
select poser_verrou('<réservation>', 7);                                  -- appel répété
-- minutes restantes avant le correctif : 10    après le correctif : 1
```

### Correction
- Le délai court à partir de la création de la réservation (`reservation.cree_at`) et n'est plus jamais repoussé : toutes les places d'une réservation expirent ensemble.
- Un appel répété sur une place déjà verrouillée par la même réservation reste accepté (réponse positive) mais ne modifie pas l'échéance.
- Une réservation de plus de 10 minutes ne peut plus poser de verrou, même sur une place libre.

### Validation
- Trois tests de non-régression ajoutés dans `db/tests/contraintes.sql` : T39 (l'échéance n'est pas repoussée), T40 (une réservation périmée ne peut plus verrouiller) et T41 (elle ne peut pas reprendre un verrou expiré).
- Les 38 tests existants passent toujours, ainsi que le test de concurrence : 41 tests au total.

### Risque voisin, non traité ici
Un paiement qui aboutit **après** l'expiration du verrou (le client a payé à la 11e minute) peut trouver sa place prise par quelqu'un d'autre. La base empêche la double vente (index unique sur les billets), mais le client aurait payé sans billet. Mesure prévue côté application : à la réception de la confirmation du prestataire, tenter de reposer le verrou ; si la place n'est plus libre, déclencher un remboursement (EPIC E11, V1).
