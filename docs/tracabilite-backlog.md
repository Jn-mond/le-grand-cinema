# Traçabilité : du backlog au modèle de données

Ce document relie chaque EPIC du backlog (Trello « 1er dépôt — Le Grand Cinéma — Backlog EPICs ») à ce que la base de données apporte aujourd'hui, et indique ce qui relève de l'application ou reste à faire. Il se met à jour à chaque nouvelle migration.

Légende du statut : **Couvert** (la base fournit tout ce que l'EPIC demande côté données), **Partiel** (une partie est faite, le reste est précisé), **Application** (l'EPIC ne demande rien de plus à la base), **À venir** (prévu pour une release ultérieure).

## Vue d'ensemble

| EPIC | Release | Priorité | Statut côté base |
|---|---|---|---|
| E1 Catalogue et programmation publique | MVP | Must | Couvert |
| E2 Disponibilités et plan de salle en temps réel | MVP | Must | Couvert (diffusion en temps réel : application) |
| E3 Réservation et verrou de places | MVP | Must | Couvert |
| E4 Paiement en ligne sécurisé | MVP | Must | Couvert (hypothèse H4 à valider) |
| E5 Billet dématérialisé et contrôle d'accès | MVP | Must | Couvert (signature du QR code : application) |
| E6 Réservation invité et compte client | MVP / V1 | Should | Couvert pour l'invité ; compte complet en V1 |
| E7 Gestion de la programmation | MVP | Must | Partiel (un seul prix par séance) |
| E8 Suivi des réservations et ventes guichet | MVP | Must | Couvert depuis la migration 0002 |
| E9 Pilotage : remplissage et indicateurs | MVP « lite » | Should | Couvert pour le taux de remplissage |
| E10 Anticipation des pics et mode festival | V2 | Could | Partiel (historique conservé, pas de table dédiée) |
| E11 Annulation, modification, remboursement | V1 | Should | Partiel (statuts prévus, pas de table de remboursement) |
| E12 Socle transverse (sécurité, RGPD, supervision…) | MVP, en continu | Must | Partiel |
| E13 Groupes et privatisation de salles | V2 | Could | À venir |
| E14 Fidélité, offres et communication | V2 | Could | À venir |

## Détail par EPIC

### E1 — Catalogue et programmation publique (U1, U2, U3)
- **Base :** tables `film`, `genre`, `film_genre`, `salle`, `seance`. Les synopsis existent en français et en anglais (`synopsis_fr`, `synopsis_en`) pour l'interface bilingue. Seules les séances au statut `publiee` sont destinées à l'affichage public.
- **Application :** traduction de l'interface, recherche et filtres.

### E2 — Disponibilités et plan de salle en temps réel (U1, U2)
- **Base :** `place` (rangée, numéro, position et accessibilité PMR pour dessiner le plan), vue `vue_places_seance` (état libre, verrouillée ou vendue pour chaque place d'une séance).
- **Critère « aucune place vendue deux fois, même sous requêtes simultanées » :** index unique partiel `billet_place_vendue_une_fois` et clé primaire de `verrou_place`, vérifiés par le test T18 et par `db/tests/concurrence.sh` (20 clients, une place, un seul gagnant).
- **Application :** diffusion des changements au navigateur (Supabase Realtime) et rafraîchissement du plan en moins de 5 secondes : cela ne se mesure pas dans la base.

### E3 — Réservation et verrou de places (U1, U2)
- **Base :** `reservation`, `verrou_place`, fonctions `poser_verrou()` et `liberer_verrous_expires()`. Le verrou dure 10 minutes (`expire_at`) ; un verrou expiré est écrasé par la réservation suivante sans attendre le nettoyage (test T16) et ne peut pas être prolongé (correctif C1, tests T39 à T41) ; la tâche planifiée libère les verrous expirés (test T17).
- **Application :** récapitulatif de la commande avant paiement, déclenchement de la tâche planifiée.

### E4 — Paiement en ligne sécurisé (U1, U2, U3)
- **Base :** `commande` (une tentative de paiement, un seul paiement validé par réservation, test T25) et `evenement_paiement` (chaque message du prestataire n'est traité qu'une fois). Aucune donnée de carte n'est stockée : la saisie se fait chez le prestataire.
- **À valider :** l'hypothèse H4 du backlog (le paiement en ligne n'est pas cité dans l'énoncé). Si la direction ne le retient pas, ces deux tables restent sans effet sur le reste du modèle.

### E5 — Billet dématérialisé et contrôle d'accès (U1, U2, U4)
- **Base :** `billet` avec un `jeton_qr` unique et un statut `valide`, `utilise` ou `annule`. Un billet « utilisé » doit porter sa date d'utilisation (contrainte `billet_utilisation_coherente`) ; le contrôle d'accès refuse un billet déjà utilisé en lisant ce statut.
- **Application :** signature cryptographique du QR code (la base ne stocke que le jeton), envoi par e-mail, scan accepté ou refusé en moins de 2 secondes.

### E6 — Réservation invité et compte client (U1, U2)
- **Base :** `reservation.utilisateur_id` vide pour un invité, avec l'e-mail obligatoire en ligne pour retrouver les billets ; table `utilisateur` prête pour le compte client complet prévu en V1.

### E7 — Gestion de la programmation (U5)
- **Base :** création et modification de `film`, `seance`, `salle` ; la contrainte `seance_pas_de_chevauchement` empêche de programmer deux séances en même temps dans une salle (tests T8 et T10) ; le statut `brouillon`, `publiee` ou `annulee` permet de publier ou retirer une séance.
- **Limite connue :** il n'y a qu'un prix par séance (`prix_centimes`). L'EPIC parle de « tarifs » : si des tarifs différenciés (réduit, enfant) sont attendus, une table de tarifs sera ajoutée dans une migration ultérieure.
- **Application :** publication visible sur le site en moins d'une minute.

### E8 — Suivi des réservations et ventes guichet (U4, U5)
- **Base :** le guichet utilise les mêmes tables et les mêmes verrous que le site : une vente au guichet retire donc immédiatement la place du stock en ligne. La migration 0002 ajoute le canal (`en_ligne` ou `guichet`) et le vendeur, et rend l'e-mail facultatif au guichet (tests T29 à T33). La migration 0003 ajoute une référence courte et le nom du client, et la fonction `rechercher_reservations()` retrouve une réservation par nom, e-mail ou référence (tests T34 à T38). L'index `reservation_seance_idx` permet de consulter les réservations d'une séance ; `vue_remplissage_seance` donne la fréquentation.
- **Pourquoi les migrations 0002 et 0003 :** en rédigeant cette traçabilité, on a constaté que la migration 0001 exigeait un e-mail pour toute réservation, ce qui rendait la vente au guichet impossible. De même, la story « Retrouver une réservation (nom, e-mail ou référence) » n'était pas réalisable sans nom de client ni référence lisible. Les deux écarts sont corrigés et testés.

### E9 — Pilotage : remplissage et indicateurs (U5)
- **Base :** `vue_remplissage_seance` calcule le taux de remplissage avec la définition du backlog : places occupées (billets valides ou utilisés) divisées par places offertes (places actives de la salle).
- **V1 :** tableaux de bord avancés, hors base.

### E10 — Anticipation des pics et mode festival (V2)
- **Base :** la réservation, la commande et le billet gardent leur date de création, et l'annulation passe par un statut plutôt que par une suppression (une réservation qui a un billet ou une commande ne peut pas être supprimée, clés étrangères en `RESTRICT`). L'historique nécessaire dès le MVP est donc conservé, à condition que l'application n'efface pas les réservations sans billet.
- **À venir :** quotas, séances additionnelles, file d'attente virtuelle. Aucune table dédiée à ce jour.

### E11 — Annulation, modification, remboursement (V1)
- **Base :** les statuts `annulee` (réservation et billet) et `echouee`/`abandonnee` (commande) existent ; une place dont le billet est annulé redevient vendable (test T23).
- **À venir :** table de remboursements et règles de modification.

### E12 — Socle transverse (tous profils)
- **Couvert par la base :** intégrité des données (clés étrangères, contraintes, tests), pas de mot de passe ni de donnée de carte stockés.
- **À venir :** règles de conservation et d'anonymisation RGPD, politiques d'accès par ligne (Row Level Security de Supabase) avec l'authentification, supervision et sauvegardes (services de la plateforme).

### E13 et E14 — V2
Aucune table à ce jour : devis et privatisation de salles (E13), offres, fidélité et notifications (E14). Le compte client prévu en V1 (`utilisateur`) leur servira de base.
