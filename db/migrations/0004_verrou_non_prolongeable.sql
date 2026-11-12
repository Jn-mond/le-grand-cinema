-- =============================================================================
-- Le Grand Cinéma — migration 0004 : correctif du verrou de place (E3)
-- À appliquer après 0003_reference_et_nom_client.sql.
--
-- Bogue : poser_verrou() remettait le compteur à 10 minutes à chaque appel fait
-- par la même réservation. Un client (ou un navigateur qui rappelle l'API en
-- boucle) pouvait donc bloquer des places indéfiniment sans jamais payer, ce qui
-- contredit la règle « une place est bloquée 10 minutes au maximum ».
-- Détail, reproduction et tests : docs/correctifs.md.
--
-- Correctif : le délai court à partir de la création de la réservation et ne se
-- prolonge plus. Toutes les places d'une réservation expirent en même temps ;
-- passé ce délai, la réservation ne peut plus verrouiller de place.
-- =============================================================================

begin;

create or replace function poser_verrou(p_reservation uuid, p_place bigint, p_duree interval default interval '10 minutes')
returns boolean language plpgsql as $$
declare
    v_seance   bigint;
    v_salle    bigint;
    v_echeance timestamptz;
    v_ok       boolean;
begin
    select r.seance_id, s.salle_id, r.cree_at + p_duree into v_seance, v_salle, v_echeance
    from reservation r
    join seance s on s.id = r.seance_id
    where r.id = p_reservation
      and r.statut = 'en_attente_paiement'
      and s.statut = 'publiee'
      and s.debut_at > now();
    if not found or v_echeance <= now() then
        return false;               -- réservation inconnue, non réservable, ou délai dépassé
    end if;

    -- Pose le verrou si la place est libre, ou remplace un verrou expiré.
    insert into verrou_place (seance_id, place_id, salle_id, reservation_id, expire_at)
    select v_seance, p_place, v_salle, p_reservation, v_echeance
    where not exists (select 1 from billet b
                      where b.seance_id = v_seance and b.place_id = p_place
                        and b.statut in ('valide', 'utilise'))
    on conflict (seance_id, place_id) do update
        set reservation_id = excluded.reservation_id,
            expire_at      = excluded.expire_at,
            cree_at        = now()
        where verrou_place.expire_at <= now()
    returning true into v_ok;

    if v_ok then
        return true;
    end if;

    -- Appel répété par la même réservation : le verrou existant reste valable,
    -- mais son échéance n'est pas repoussée.
    return exists (select 1 from verrou_place v
                   where v.seance_id = v_seance and v.place_id = p_place
                     and v.reservation_id = p_reservation
                     and v.expire_at > now());
exception
    when foreign_key_violation then
        return false;               -- la place n'appartient pas à la salle de la séance
end $$;

comment on function poser_verrou(uuid, bigint, interval) is
    'Verrouille une place pour une réservation. Le délai (10 minutes par défaut) court depuis la création de la réservation et ne se prolonge pas.';

commit;
