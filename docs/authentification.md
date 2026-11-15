# Connexion et rôles

Ce document décrit comment les personnes se connectent à l'application, comment leurs droits sont vérifiés, et où trouver la procédure de création des comptes de démonstration.

## Principe

| Élément | Choix |
|---|---|
| Identification | Supabase Auth, par adresse e-mail et mot de passe. Les mots de passe ne sont jamais stockés par l'application : ils sont gérés par Supabase Auth. |
| Session | Cookies sécurisés posés par `@supabase/ssr`. Le fichier `web/src/proxy.ts` renouvelle le jeton expiré avant chaque page. |
| Profil et rôle | Table `utilisateur`, même identifiant que le compte de connexion. La migration 0006 crée automatiquement la ligne, avec le rôle `spectateur`, à la création d'un compte. |
| Vérification | `utilisateurConnecte()` (`web/src/lib/session.ts`) est le point d'entrée unique : il fait vérifier la session par Supabase Auth (`getUser`), puis lit le profil et le rôle. |
| Contrôle d'accès | Chaque page protégée et chaque action serveur revérifie le rôle côté serveur. Masquer un lien dans l'interface ne protège rien : c'est le serveur qui décide. |
| Données | Les tables restent fermées à la clé publique (sécurité au niveau des lignes, migration 0005) : seul le serveur lit et écrit, après vérification du rôle. |

## Pages et droits

| Page | Accès | Contenu |
|---|---|---|
| `/` | Public | Programme des séances publiées à venir (E1) |
| `/films/{id}` | Public | Fiche d'un film et ses prochaines séances (E1) |
| `/seances/{id}` | Public | Plan de salle et blocage des places pendant 10 minutes (E2, E3) ; connecté, la réservation est rattachée au compte |
| `/connexion` | Public | Formulaire de connexion |
| `/espace` | Toute personne connectée | Profil et réservations rattachées au compte (E6) |
| `/admin` | Rôles `programmateur` et `administrateur` | Séances à venir, création d'une séance, publication ou retrait du site (E7) |
| `/admin/seances/{id}` | Rôles `accueil`, `programmateur` et `administrateur` | Réservations d'une séance : référence, client, places, canal, statut, date de création (E8) |

Après connexion, le personnel de programmation arrive sur `/admin`, les autres sur `/espace`. En cas d'échec, le message est le même que l'adresse existe ou non, pour ne pas révéler quels comptes existent. Supabase Auth limite par ailleurs le nombre de tentatives de connexion.

## Configuration

Deux variables s'ajoutent à `web/.env.local` et aux variables d'environnement de Vercel (*Project Settings* > *API Keys* de Supabase) :

| Variable | Valeur |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL du projet (la même que `SUPABASE_URL`) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Clé publique (`sb_publishable_…`) |

Le préfixe `NEXT_PUBLIC_` rend ces valeurs visibles par le navigateur : c'est sans danger pour l'URL et la clé publique, qui n'ouvrent aucune donnée. La clé secrète, elle, garde un nom sans ce préfixe et ne quitte jamais le serveur.

## Comptes de démonstration

La création des deux comptes remis à l'évaluateur (administrateur et spectateur) est décrite dans [`comptes-demo.md`](comptes-demo.md).
