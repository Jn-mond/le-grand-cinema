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

## C2 — Expression régulière vulnérable au déni de service (ReDoS)

| | |
|---|---|
| **Où** | `web/src/modules/reservations/schemas.ts`, validation de l'adresse e-mail à l'ouverture d'une réservation. |
| **Détecté par** | SonarQube Cloud, règle « super-linear regex » (fiabilité, gravité moyenne). |
| **Gravité** | Élevée en pratique : l'API est publique, un seul appel suffit à occuper le serveur. |
| **Statut** | Corrigé. |

### Symptôme et cause
L'ancienne expression `^[^@\s]+@[^@\s]+\.[^@\s]+$` laisse le domaine et son extension accepter tous les deux des points. Sur une entrée qui échoue tout au bout, le moteur essaie chaque point comme séparateur possible et relit la fin de chaîne à chaque essai : le temps croît avec le carré de la longueur. La limite de 254 caractères du schéma ne protège pas, car zod applique toutes les vérifications, y compris l'expression, même quand la longueur est déjà refusée.

### Reproduction (mesurée)
Entrée piégée : `"a@" + "a.".repeat(n) + "@"`.

| Longueur | Ancienne expression | Nouvelle expression |
|---|---|---|
| 10 000 caractères | 24 ms | 0,04 ms |
| 40 000 caractères | 570 à 740 ms | 0,4 ms |

Le corps d'une requête pouvant atteindre plusieurs mégaoctets, quelques appels suffisaient à bloquer les fonctions serveur.

### Correction
`^[^@\s]+@[^@\s.]+(?:\.[^@\s.]+)+$` : le domaine est découpé en segments qui excluent le point, si bien qu'il n'existe qu'une seule façon de lire la chaîne et l'évaluation reste linéaire. Effet de bord assumé : les domaines mal formés (`a@b..c`, `a@.b.c`, `a@b.c.`) sont désormais refusés. La contrainte de la base n'est pas concernée : le moteur d'expressions régulières de PostgreSQL ne procède pas par retour arrière.

### Validation
- Deux tests ajoutés dans `schemas.test.ts` : refus des domaines mal formés, et rejet d'une adresse piégée de 40 000 caractères en moins de 100 ms.
- Contre-épreuve : avec l'ancienne expression, ces deux tests échouent.
- Nouvelle analyse SonarQube Cloud : le problème doit passer à l'état « corrigé ».

## C3 — Retour sur une séance : la réservation expirée revenait en boucle (E3)

| | |
|---|---|
| **Où** | Page de réservation `/seances/{id}`, composant `plan-de-salle.tsx`. |
| **Détecté par** | Recette manuelle de la release 0.3.0 (parcours complet d'un spectateur connecté). |
| **Gravité** | Moyenne : aucune donnée n'est faussée, mais le spectateur ne peut plus réserver cette séance sans recharger la page. |
| **Statut** | Corrigé. |

### Symptôme
Parcours : bloquer deux places, laisser passer les 10 minutes (« Délai dépassé »), aller dans « Mon espace » (réservation « Expirée »), revenir au programme, cliquer sur « Réserver » pour la même séance. La page réaffiche l'ancien récapitulatif « Places bloquées … Délai dépassé » au lieu du plan de salle, alors que l'en-tête annonce bien 24 places libres. Chaque nouvel essai ramène au même écran.

### Recherche de la cause
L'en-tête est juste : les données du serveur sont relues. C'est l'état du navigateur qui est ancien. Avec `cacheComponents`, Next.js 16 ne détruit pas une page quittée : il la cache avec le composant React `<Activity>` pour la retrouver intacte au retour (saisie, défilement, messages). Le résultat de l'action « bloquer mes places » (`useActionState`) était donc conservé, y compris après son expiration.

### Reproduction
Banc d'essai hors dépôt : le composant réel est rendu dans Chromium (Playwright) à l'intérieur d'un `<Activity>`, avec une action simulée qui bloque les places pour 3 secondes. Après l'expiration, on masque puis on réaffiche la page, comme une navigation aller-retour : l'ancienne version réaffiche « Places bloquées », la nouvelle affiche « Choisissez vos places ».

### Correction
- Quand le spectateur quitte la page, un refus, une erreur ou des places dont le délai est dépassé sont oubliés (`resultatAOublier()`) : au retour, le formulaire repart de zéro. Des places encore bloquées restent affichées avec leur compte à rebours, ce qui est le comportement voulu.
- À l'expiration, un bouton « Choisir de nouvelles places » permet de recommencer sans quitter la page.
- Un message de refus reste affiché quand le plan se met à jour après ce refus : seul le départ de la page le fait disparaître.

### Validation
- Trois tests unitaires sur `resultatAOublier()` dans `regles.test.ts`.
- Banc d'essai navigateur : les quatre scénarios (aller-retour pendant le délai, expiration puis bouton, aller-retour après expiration, refus) donnent le résultat attendu, sans erreur dans la console.

## C4 — Une réservation non payée restait « en attente de paiement » (E3, E6)

| | |
|---|---|
| **Où** | Espace client `/espace`. |
| **Gravité** | Faible : affichage trompeur, sans effet sur les places. |
| **Statut** | Corrigé à l'affichage ; mise à jour en base prévue avec le paiement (E4). |

### Symptôme et cause
Rien ne fait passer une réservation de `en_attente_paiement` à `expiree` dans la base : la tâche planifiée libère les verrous, pas les réservations. Sans paiement, le client voyait donc indéfiniment « En attente de paiement » pour des places déjà libérées.

### Correction et validation
`statutAffiche()` affiche « Expirée » dès que le délai de 10 minutes est dépassé. Deux tests unitaires dans `regles.test.ts` ; vérifié en recette (LGC-LKJCDG passée de « En attente de paiement » à « Expirée »). La mise à jour du statut en base sera faite par la tâche planifiée lors de l'arrivée du paiement (E4).
