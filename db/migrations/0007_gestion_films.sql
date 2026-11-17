-- =============================================================================
-- Le Grand Cinéma — migration 0007 : créer et modifier un film (E7)
-- À appliquer après 0006_authentification.sql.
--
-- Un film et ses genres sont enregistrés en une seule fois par enregistrer_film() :
-- la fiche et la liste des genres ne peuvent pas se retrouver à moitié modifiées.
-- La durée d'un film ne change plus dès qu'une séance non annulée, en cours ou à
-- venir, en dépend : l'heure de fin de ces séances a été calculée avec elle.
-- =============================================================================

begin;

alter table film
    add constraint film_titre_non_vide check (btrim(titre) <> ''),
    add constraint film_affiche_https  check (affiche_url is null or affiche_url ~ '^https://');

create function enregistrer_film(
    p_id             bigint,
    p_titre          text,
    p_titre_original text,
    p_duree_minutes  smallint,
    p_age_minimum    smallint,
    p_date_sortie    date,
    p_synopsis_fr    text,
    p_affiche_url    text,
    p_actif          boolean,
    p_genres         smallint[]
) returns bigint
language plpgsql
set search_path = public
as $$
declare
    v_id    bigint;
    v_duree smallint;
begin
    if p_id is null then
        insert into film (titre, titre_original, synopsis_fr, duree_minutes, age_minimum,
                          date_sortie, affiche_url, actif)
        values (p_titre, p_titre_original, p_synopsis_fr, p_duree_minutes, p_age_minimum,
                p_date_sortie, p_affiche_url, p_actif)
        returning id into v_id;
    else
        select duree_minutes into v_duree from film where id = p_id for update;
        if not found then
            return null;                       -- film introuvable : rien n'est modifié
        end if;
        if v_duree <> p_duree_minutes and exists (
            select 1 from seance
            where film_id = p_id and statut <> 'annulee' and fin_at > now()
        ) then
            raise exception 'La durée ne peut plus changer : des séances à venir en dépendent'
                using errcode = 'LGC01';
        end if;
        update film
           set titre = p_titre, titre_original = p_titre_original, synopsis_fr = p_synopsis_fr,
               duree_minutes = p_duree_minutes, age_minimum = p_age_minimum,
               date_sortie = p_date_sortie, affiche_url = p_affiche_url, actif = p_actif
         where id = p_id;
        delete from film_genre where film_id = p_id;
        v_id := p_id;
    end if;

    insert into film_genre (film_id, genre_id)
    select distinct v_id, g from unnest(coalesce(p_genres, '{}'::smallint[])) as g;

    return v_id;
end $$;

comment on function enregistrer_film(bigint, text, text, smallint, smallint, date, text, text, boolean, smallint[]) is
    'Crée (p_id vide) ou modifie un film et remplace ses genres ; refuse un changement de durée si des séances à venir en dépendent (LGC01).';

-- Même règle que la migration 0005 : seule l'application, côté serveur, appelle les fonctions.
revoke execute on function enregistrer_film(bigint, text, text, smallint, smallint, date, text, text, boolean, smallint[]) from public;
do $$
begin
    if exists (select 1 from pg_roles where rolname = 'anon') then
        execute 'revoke execute on function enregistrer_film(bigint, text, text, smallint, smallint, date, text, text, boolean, smallint[]) from anon, authenticated';
        execute 'grant execute on function enregistrer_film(bigint, text, text, smallint, smallint, date, text, text, boolean, smallint[]) to service_role';
    end if;
end $$;

commit;
