# Billets et contrôle à l'entrée (E5)

## Le billet

Chaque place payée donne un billet (`billet`, créé par `confirmer_commande()` au paiement). Le billet porte un **jeton** (`billet.jeton_qr`) : une valeur aléatoire de 122 bits (`gen_random_uuid()`), unique, impossible à deviner. Le QR code contient ce jeton et rien d'autre : ni nom, ni e-mail, ni prix. Le jeton est aussi imprimé en clair sous le QR code, pour une saisie à la main si l'image est abîmée.

Le jeton n'a pas besoin d'être signé : il n'a aucune valeur en dehors de la base, qui est seule à dire s'il correspond à un billet valide. Une copie du QR code ne sert qu'une fois (voir plus bas).

Où le spectateur trouve ses billets :
- sur la page `/reservations/{id}`, où Stripe le renvoie après le paiement : un QR code par place, avec son état (valide, ou utilisé avec l'heure du passage) ;
- dans **Mon espace**, lien « Voir mes billets » sur chaque réservation confirmée, s'il a un compte.

Le QR code est calculé sur le serveur (bibliothèque `qrcode`) et envoyé comme image : rien à installer pour le spectateur, la page s'imprime telle quelle.

## Le contrôle

La page `/controle` est réservée aux rôles `accueil`, `programmateur` et `administrateur` (lien « Contrôle » dans l'en-tête). Une douchette lit le QR code et « tape » le jeton dans le champ, suivi d'Entrée ; le résultat s'affiche en grand, vert ou rouge, et le champ se vide pour le billet suivant.

```
Poste de contrôle (douchette) ──jeton──▶ Serveur (action controler, rôle revérifié)
                                             │
                                             ▼
                                   PostgreSQL : controler_billet(jeton)
                                   UPDATE billet SET statut = 'utilise', utilise_at = now()
                                    WHERE jeton_qr = :jeton AND statut = 'valide'
                                      AND séance non annulée
                                      AND maintenant entre début − 60 min et fin de séance
                                             │
                     1 ligne modifiée ◀──────┴──────▶ 0 ligne : lecture du billet pour
                     « Entrée autorisée »              expliquer le refus
```

| Résultat | Affichage |
|---|---|
| `accepte` | Entrée autorisée : film, séance, salle, place |
| `deja_utilise` | Billet déjà utilisé, avec l'heure du premier passage |
| `trop_tot` | Le contrôle ouvre 60 minutes avant le début de la séance |
| `seance_terminee`, `seance_annulee`, `annule` | Refus avec la raison |
| `inconnu` | Ce code ne correspond à aucun billet |

**Un billet n'ouvre l'entrée qu'une fois**, même si deux postes scannent le même QR code au même instant (billet partagé par capture d'écran) : la vérification et le marquage sont une seule instruction `UPDATE … WHERE statut = 'valide'`. PostgreSQL verrouille la ligne pour le premier poste ; le second relit la ligne après lui, ne trouve plus de billet valide et affiche « Billet déjà utilisé ». Il n'y a pas de lecture suivie d'une écriture, donc pas de fenêtre où les deux passeraient. Vérifié par `db/tests/concurrence_controle.sh` : 10 contrôles simultanés du même billet, 1 accepté, 9 refusés. Un refus ne modifie jamais le billet (test T69).

## Tests

- SQL : T65 à T72 dans `db/tests/contraintes.sql` (accepté, déjà utilisé, inconnu, trop tôt sans consommer le billet, annulé, séance terminée, séance annulée).
- Concurrence : `db/tests/concurrence_controle.sh`.
- Application : `web/src/modules/billets/controle.test.ts` (lecture du jeton saisi par la douchette, messages affichés).

## Recette

1. Avec un compte programmateur, programmer une séance qui commence dans moins d'une heure.
2. En spectateur, réserver et payer une place (carte `4242 4242 4242 4242`) : la page affiche le billet et son QR code.
3. Avec le compte programmateur, ouvrir **Contrôle** et coller le code imprimé sous le QR code (ou le scanner avec un téléphone et une application de lecture, puis copier le texte) : « Entrée autorisée ».
4. Recommencer avec le même code : « Billet déjà utilisé », avec l'heure du premier passage. La page du billet indique « Utilisé le … ».
5. Contrôler un billet d'une séance de demain : « Trop tôt », et le billet reste valide.

## Limites

- **Envoi des billets par e-mail** : pas dans cette version (pas de domaine d'envoi vérifié). Les billets restent accessibles par la page de la réservation et dans Mon espace.
- **Contrôle sans réseau** : le poste interroge la base à chaque passage. En cas de coupure, le personnel s'appuie sur la liste des réservations de la séance (`/admin/seances/{id}`), consultable avant la séance.
