# API REST

L'API est servie par l'application Next.js (`web/src/app/api`). Elle échange du JSON et suit le monolithe modulaire décrit dans l'architecture : une route HTTP fine, un service métier testable, un dépôt d'accès aux données.

## Documentation interactive

- Spécification OpenAPI 3.1 : `web/public/openapi.json`, servie à l'adresse `/openapi.json`.
- Interface Swagger UI : `/docs-api.html` (en local : http://localhost:3000/docs-api.html). Elle permet d'essayer chaque route.

## Routes

| Méthode et chemin | Story | Rôle |
|---|---|---|
| `GET /api/seances/{id}/places` | E2, E3 | Plan de salle : état de chaque place (libre, verrouillée, vendue) |
| `POST /api/reservations` | E3 | Ouvre une réservation ; le client a 10 minutes pour choisir et payer |
| `POST /api/reservations/{id}/verrous` | E3 | Bloque les places choisies, toutes ou aucune, jusqu'à l'échéance |

## Exemple de parcours

```bash
# 1. Voir les places de la séance 1
curl http://localhost:3000/api/seances/1/places

# 2. Ouvrir une réservation (réponse : id, reference, expireAt)
curl -X POST http://localhost:3000/api/reservations \
  -H "Content-Type: application/json" \
  -d '{"seanceId": 1, "email": "alice@exemple.fr"}'

# 3. Bloquer trois places
curl -X POST http://localhost:3000/api/reservations/<id>/verrous \
  -H "Content-Type: application/json" \
  -d '{"placeIds": [12, 13, 14]}'
```

## Erreurs

Toutes les erreurs suivent le format « problem details » (RFC 9457, type `application/problem+json`) avec un `code` stable que l'interface peut traduire :

| Code | Statut | Cas |
|---|---|---|
| `REQUETE_INVALIDE` | 400 | JSON mal formé, champ manquant ou invalide (liste des champs dans `erreurs`), champ inconnu |
| `SEANCE_INTROUVABLE` | 404 | Séance inconnue ou non publiée |
| `SEANCE_NON_RESERVABLE` | 422 | Séance non publiée ou déjà commencée |
| `RESERVATION_INTROUVABLE` | 404 | Réservation inconnue |
| `RESERVATION_NON_MODIFIABLE` | 409 | Réservation déjà confirmée, annulée ou expirée |
| `RESERVATION_EXPIREE` | 410 | Délai de 10 minutes dépassé |
| `PLACES_INDISPONIBLES` | 409 | Au moins une place est prise ; aucune n'a été bloquée (`placesRefusees`) |
| `PLACES_TROP_NOMBREUSES` | 422 | Plus de 10 places demandées |
| `CONFIGURATION_MANQUANTE` | 500 | Variables d'environnement Supabase absentes |
| `ERREUR_INTERNE` | 500 | Erreur inattendue : journalisée côté serveur, détail jamais renvoyé au client |

## Organisation du code

```text
web/src/
├── app/api/…/route.ts        routes HTTP : lisent la requête, valident, appellent le service
├── lib/
│   ├── erreurs.ts            erreurs métier et leur statut HTTP
│   ├── http.ts               réponses JSON, conversion des erreurs, lecture du corps
│   └── supabase-serveur.ts   client Supabase côté serveur (clé secrète, jamais envoyée au navigateur)
└── modules/
    ├── reservations/
    │   ├── regles.ts         règles métier pures (10 minutes, nombre de places)
    │   ├── schemas.ts        validation des entrées (zod)
    │   ├── service.ts        cas d'usage : créer une réservation, bloquer des places
    │   ├── depot.ts          contrat d'accès aux données
    │   └── depot-supabase.ts implémentation du contrat avec Supabase
    └── seances/              même découpage pour le plan de salle
```

Le service ne dépend que du contrat `depot.ts` : les tests unitaires lui donnent un dépôt en mémoire, sans base ni réseau. La règle « toutes les places ou aucune » est garantie par la base (`poser_verrous()`), testée par les tests SQL.

## Hypothèses à valider

- **10 places au maximum par réservation** : limite choisie pour éviter qu'une seule réservation bloque une salle entière. Elle n'est pas fixée par le backlog et reste à confirmer avec le cinéma.
- **Pas encore d'authentification** : ces routes servent le parcours invité (E6). L'accès réservé au personnel arrivera avec la connexion des utilisateurs.
