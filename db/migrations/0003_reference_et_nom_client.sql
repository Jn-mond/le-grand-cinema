-- =============================================================================
-- Le Grand Cinéma — migration 0003 : référence de réservation et nom du client (E8)
-- À appliquer après 0002_vente_guichet.sql.
--
-- Constat : la story E8 « Retrouver une réservation (nom, e-mail ou référence) »
-- n'était pas réalisable. Une réservation prise au guichet ou par un invité n'avait
-- ni nom de client, et l'identifiant uuid est inutilisable à l'oral ou au téléphone.
--
-- Changement :
--  - nom_client : nom donné par le client (facultatif) ;
--  - reference : code court, unique et lisible (ex. LGC-7K4Q2M), sans caractères
--    ambigus (pas de 0, O, 1, I) ;
--  - rechercher_reservations() : recherche par référence, e-mail ou début de nom.
-- =============================================================================

begin;

create function generer_reference() returns text language plpgsql as $$
declare
    alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   -- 32 caractères, sans 0 O 1 I
    ref text;
begin
    loop
        ref := 'LGC-' || (select string_agg(substr(alphabet, 1 + floor(random() * 32)::int, 1), '')
                          from generate_series(1, 6));
        exit when not exists (select 1 from reservation where reference = ref);
    end loop;
    return ref;
end $$;

alter table reservation
    add column nom_client text,
    add column reference  text;

-- Réservations existantes : une référence chacune, puis la colonne devient obligatoire.
do $$
declare r record;
begin
    for r in select id from reservation where reference is null loop
        update reservation set reference = generer_reference() where id = r.id;
    end loop;
end $$;

alter table reservation
    alter column reference set not null,
    alter column reference set default generer_reference(),
    add constraint reservation_reference_unique unique (reference),
    add constraint reservation_reference_format check (reference ~ '^LGC-[A-HJ-NP-Z2-9]{6}$'),
    add constraint reservation_nom_client_valide check (nom_client is null or length(btrim(nom_client)) > 0);

create index reservation_nom_idx on reservation (lower(nom_client) text_pattern_ops);

-- Recherche pour le personnel d'accueil : référence exacte, e-mail exact, ou début de nom.
-- À réserver aux rôles « accueil », « programmateur » et « administrateur » côté application.
create function rechercher_reservations(p_terme text)
returns setof reservation language sql stable as $$
    select r.*
    from reservation r
    where length(btrim(p_terme)) >= 2
      and (   r.reference = upper(btrim(p_terme))
           or lower(r.email) = lower(btrim(p_terme))
           or lower(r.nom_client) like lower(btrim(p_terme)) || '%')
    order by r.cree_at desc
    limit 50;
$$;

comment on column reservation.nom_client is 'Nom donné par le client (invité ou guichet) pour retrouver sa réservation ; facultatif.';
comment on column reservation.reference  is 'Référence courte et lisible de la réservation (LGC- suivi de 6 caractères), unique.';
comment on function rechercher_reservations(text) is 'Recherche (50 résultats au plus) par référence exacte, e-mail exact ou début de nom. Usage réservé au personnel.';

commit;
