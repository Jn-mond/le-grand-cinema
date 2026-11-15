# Comptes de démonstration

Ce document décrit comment créer les deux comptes remis à l'évaluateur : un administrateur, qui programme les séances (`/admin`), et un spectateur, qui réserve (`/espace`). Le fonctionnement de la connexion et des rôles est décrit dans [`authentification.md`](authentification.md).

## Procédure

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
