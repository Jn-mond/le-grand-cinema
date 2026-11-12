-- =============================================================================
-- Le Grand Cinéma — migration 0005 : verrouillage de plusieurs places et
-- protection de l'API Supabase (E3, E12)
-- À appliquer après 0004_verrou_non_prolongeable.sql.
--
-- 1. poser_verrous() : verrouille toutes les places choisies d'un coup, ou
--    aucune. Un client qui choisit 3 places côte à côte ne doit pas se retrouver
--    avec 2 places bloquées et la 3e prise par quelqu'un d'autre.
--    Les places sont traitées par numéro croissant : deux réservations
--    simultanées prennent les verrous dans le même ordre, ce qui évite les
--    interblocages (deadlocks).
--
-- 2. Sécurité : Supabase publie automatiquement les tables, les vues et les
--    fonctions du schéma public sur son API. Sans précaution, la clé publique
--    (anon) donnerait accès à toutes les données. On active la sécurité au
--    niveau des lignes (RLS) sans aucune règle d'accès : seule l'application,
--    côté serveur avec la clé secrète, lit et écrit. Les règles d'accès fines
--    (par utilisateur connecté) viendront avec l'authentification.
--    Les rôles anon, authenticated et service_role n'existent que sur
--    Supabase : sur un PostgreSQL ordinaire, cette partie est ignorée.
-- =============================================================================

begin;

-- 1. Verrouillage de plusieurs places --------------------------------------------
create function poser_verrous(p_reservation uuid, p_places bigint[])
returns bigint[] language plpgsql as $$
declare
    v_places   bigint[];
    v_refusees bigint[] := '{}';
    v_place    bigint;
begin
    select coalesce(array_agg(distinct p order by p), '{}') into v_places
    from unnest(p_places) as p;

    if cardinality(v_places) = 0 then
        return v_refusees;
    end if;

    begin
        foreach v_place in array v_places loop
            if not poser_verrou(p_reservation, v_place) then
                v_refusees := v_refusees || v_place;
            end if;
        end loop;
        if cardinality(v_refusees) > 0 then
            -- annule les verrous posés dans ce bloc ; la liste des refus est conservée
            raise exception 'places indisponibles' using errcode = 'P0001';
        end if;
    exception
        when sqlstate 'P0001' then
            return v_refusees;
    end;

    return v_refusees;      -- vide : toutes les places sont verrouillées
end $$;

comment on function poser_verrous(uuid, bigint[]) is
    'Verrouille toutes les places demandées pour la réservation, ou aucune. Retourne les places refusées (tableau vide en cas de succès).';

-- 2. Protection de l'API Supabase ---------------------------------------------------
alter table utilisateur        enable row level security;
alter table genre              enable row level security;
alter table film               enable row level security;
alter table film_genre         enable row level security;
alter table salle              enable row level security;
alter table place              enable row level security;
alter table seance             enable row level security;
alter table reservation        enable row level security;
alter table commande           enable row level security;
alter table evenement_paiement enable row level security;
alter table verrou_place       enable row level security;
alter table billet             enable row level security;

revoke execute on all functions in schema public from public;

do $$
begin
    if exists (select 1 from pg_roles where rolname = 'anon') then
        -- les vues s'exécutent avec les droits de leur propriétaire : la RLS ne les protège pas
        execute 'revoke all on vue_places_seance, vue_remplissage_seance from anon, authenticated';
        execute 'revoke execute on all functions in schema public from anon, authenticated';
    end if;
    if exists (select 1 from pg_roles where rolname = 'service_role') then
        execute 'grant execute on all functions in schema public to service_role';
        execute 'grant select on vue_places_seance, vue_remplissage_seance to service_role';
    end if;
end $$;

commit;
