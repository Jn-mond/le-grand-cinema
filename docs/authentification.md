# Connexion et rôles

Ce document décrit comment les personnes se connectent à l'application, comment leurs droits sont vérifiés, et comment créer les comptes de démonstration (administrateur et spectateur) remis à l'évaluateur.

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
| `/connexion` | Public | Formulaire de connexion |
| `/espace` | Toute personne connectée | Profil et réservations rattachées au compte (E6) |
| `/admin` | Rôles `programmateur` et `administrateur` | Séances à venir et création d'une séance (E7) |

Après connexion, le personnel de programmation arrive sur `/admin`, les autres sur `/espace`. En cas d'échec, le message est le même que l'adresse existe ou non, pour ne pas révéler quels comptes existent. Supabase Auth limite par ailleurs le nombre de tentatives de connexion.

## Configuration

Deux variables s'ajoutent à `web/.env.local` et aux variables d'environnement de Vercel (*Project Settings* > *API Keys* de Supabase) :

| Variable | Valeur |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL du projet (la même que `SUPABASE_URL`) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Clé publique (`sb_publishable_…`) |

Le préfixe `NEXT_PUBLIC_` rend ces valeurs visibles par le navigateur : c'est sans danger pour l'URL et la clé publique, qui n'ouvrent aucune donnée. La clé secrète, elle, garde un nom sans ce préfixe et ne quitte jamais le serveur.

## Créer les comptes de démonstration

1. Appliquer la migration `0006_authentification.sql` (SQL Editor de Supabase).
2. Dans Supabase, *Authentication* > *Users* > *Add user* > *Create new user*, cocher **Auto Confirm User**, et créer :
   - `admin.demo@le-grand-cinema.test` ;
   - `spectateur.demo@le-grand-cinema.test`.

   Choisir pour chacun un mot de passe solide (au moins 12 caractères). **Les mots de passe ne sont jamais écrits dans le dépôt** : ils figurent uniquement dans le dossier remis à l'évaluateur.
3. Donner le rôle administrateur et les noms affichés (SQL Editor) :
   ```sql
   update utilisateur set role = 'administrateur', prenom = 'Admin', nom = 'Démo'
   where email = 'admin.demo@le-grand-cinema.test';
   update utilisateur set prenom = 'Spectateur', nom = 'Démo'
   where email = 'spectateur.demo@le-grand-cinema.test';
   ```
4. Recommandé : *Authentication* > *Sign In / Providers*, désactiver **Allow new users to sign up**. L'application n'a pas de page d'inscription ; sans ce réglage, n'importe qui pourrait créer un compte avec la clé publique.

Une adresse déjà présente dans `utilisateur` (par exemple celles du jeu d'essai) ne peut pas servir à créer un compte de connexion : la création est refusée pour éviter deux profils pour la même personne.
