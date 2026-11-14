-- =============================================================================
-- Le Grand Cinéma — migration 0006 : comptes de connexion (E6, E12)
-- À appliquer après 0005_verrou_multiple_et_securite_api.sql.
--
-- La connexion (e-mail et mot de passe) est gérée par Supabase Auth, qui
-- enregistre les comptes dans auth.users. Cette migration crée automatiquement
-- la ligne correspondante dans utilisateur, avec le même identifiant, dès qu'un
-- compte de connexion est créé. Le rôle par défaut est « spectateur » : seul un
-- administrateur peut l'élever, directement en base (voir docs/comptes-demo.md).
--
-- Le schéma auth n'existe que sur Supabase : sur un PostgreSQL ordinaire (tests,
-- vérification automatique), la fonction est créée mais le déclencheur ne l'est pas.
-- =============================================================================

begin;

create function creer_utilisateur_depuis_auth() returns trigger
language plpgsql
security definer          -- s'exécute avec les droits du propriétaire : peut écrire dans public.utilisateur
set search_path = ''      -- noms entièrement qualifiés : aucun objet ne peut être substitué
as $$
begin
    insert into public.utilisateur (id, email, nom, prenom)
    values (
        new.id,
        new.email,
        coalesce(nullif(btrim(new.raw_user_meta_data ->> 'nom'), ''), split_part(new.email, '@', 1)),
        coalesce(nullif(btrim(new.raw_user_meta_data ->> 'prenom'), ''), '-')
    )
    on conflict (id) do nothing;
    return new;
end $$;

comment on function creer_utilisateur_depuis_auth() is
    'Crée la ligne utilisateur (rôle spectateur) à la création d''un compte de connexion Supabase Auth.';

revoke execute on function creer_utilisateur_depuis_auth() from public;

do $$
begin
    if exists (select 1 from pg_roles where rolname = 'anon') then
        execute 'revoke execute on function creer_utilisateur_depuis_auth() from anon, authenticated';
    end if;
    if to_regclass('auth.users') is not null then
        execute 'create trigger utilisateur_depuis_auth
                     after insert on auth.users
                     for each row execute function public.creer_utilisateur_depuis_auth()';
    end if;
end $$;

commit;
