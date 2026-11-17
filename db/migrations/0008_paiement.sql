-- =============================================================================
-- Le Grand Cinéma — migration 0008 : paiement en ligne (E4)
-- À appliquer après 0007_gestion_films.sql.
--
-- Le paiement passe par la page hébergée de Stripe, en mode test. Une commande est
-- ouverte pour les places bloquées, puis confirmée quand Stripe annonce, par webhook,
-- que la carte a été autorisée. L'argent n'est prélevé (capture) qu'après la
-- création des billets : si les places ont été perdues entre-temps, l'autorisation
-- est annulée et le client n'est jamais débité.
--
-- Cas du paiement tardif : le verrou dure 10 minutes, la page Stripe au moins 30.
-- À la confirmation, une place dont le verrou a expiré reste vendable si personne
-- ne l'a prise ; si une autre réservation l'a bloquée ou achetée, la commande
-- échoue (places_perdues). L'index unique billet_place_vendue_une_fois reste le
-- dernier filet de sécurité si deux confirmations arrivent au même instant.
-- =============================================================================

begin;

-- Places payées par la commande : elles sont fixées à l'ouverture, car les verrous
-- de la réservation peuvent avoir disparu quand la confirmation arrive.
alter table commande add column places bigint[] not null default '{}';

-- -----------------------------------------------------------------------------
-- Ouvrir une commande pour les places bloquées d'une réservation
-- Erreurs : LGC02 plus aucune place bloquée (délai dépassé), LGC03 réservation
-- déjà confirmée, annulée ou expirée, LGC04 réservation introuvable.
-- -----------------------------------------------------------------------------
create function ouvrir_commande(p_reservation uuid)
returns table (
    commande_id      uuid,
    montant          integer,
    nb_places        integer,
    prix_unitaire    integer,
    email_client     text,
    titre_film       text,
    debut_seance     timestamptz,
    verrou_expire_at timestamptz
)
language plpgsql
set search_path = public
as $$
declare
    v_statut  statut_reservation;
    v_email   text;
    v_prix    integer;
    v_debut   timestamptz;
    v_titre   text;
    v_places  bigint[];
    v_expire  timestamptz;
    v_id      uuid;
begin
    select r.statut, r.email, s.prix_centimes, s.debut_at, f.titre
      into v_statut, v_email, v_prix, v_debut, v_titre
      from reservation r
      join seance s on s.id = r.seance_id
      join film f on f.id = s.film_id
     where r.id = p_reservation
       for update of r;
    if not found then
        raise exception 'Réservation introuvable' using errcode = 'LGC04';
    end if;
    if v_statut <> 'en_attente_paiement' then
        raise exception 'Réservation %', v_statut using errcode = 'LGC03';
    end if;

    select array_agg(v.place_id order by v.place_id), min(v.expire_at)
      into v_places, v_expire
      from verrou_place v
     where v.reservation_id = p_reservation and v.expire_at > now();
    if v_places is null then
        raise exception 'Plus aucune place bloquée' using errcode = 'LGC02';
    end if;

    insert into commande (reservation_id, montant_centimes, places)
    values (p_reservation, cardinality(v_places) * v_prix, v_places)
    returning id into v_id;

    return query select v_id, cardinality(v_places) * v_prix, cardinality(v_places), v_prix,
                        v_email, v_titre, v_debut, v_expire;
end $$;

comment on function ouvrir_commande(uuid) is
    'Ouvre une commande pour les places encore bloquées de la réservation et renvoie de quoi créer la page de paiement.';

-- -----------------------------------------------------------------------------
-- Confirmer une commande quand le prestataire annonce le paiement autorisé
-- Résultats : confirmee, deja_confirmee, places_perdues, reservation_close,
-- montant_incorrect, introuvable. Seuls les deux premiers autorisent la capture.
-- -----------------------------------------------------------------------------
create function confirmer_commande(p_commande uuid, p_paiement text, p_montant integer)
returns text
language plpgsql
set search_path = public
as $$
declare
    v_commande commande%rowtype;
    v_statut   statut_reservation;
    v_seance   bigint;
    v_salle    bigint;
    v_prix     integer;
begin
    select c.* into v_commande from commande c where c.id = p_commande for update;
    if not found then
        return 'introuvable';
    end if;
    if v_commande.statut = 'payee' then
        return 'deja_confirmee';            -- webhook reçu une seconde fois
    end if;

    select r.statut, r.seance_id, s.salle_id, s.prix_centimes
      into v_statut, v_seance, v_salle, v_prix
      from reservation r
      join seance s on s.id = r.seance_id
     where r.id = v_commande.reservation_id
       for update of r;

    if v_commande.montant_centimes <> p_montant then
        update commande set statut = 'echouee', prestataire_paiement_id = p_paiement where id = p_commande;
        return 'montant_incorrect';
    end if;
    if v_statut <> 'en_attente_paiement' then
        -- par exemple une seconde page de paiement réglée après la première
        update commande set statut = 'echouee', prestataire_paiement_id = p_paiement where id = p_commande;
        return 'reservation_close';
    end if;

    -- Les verrous de ces places sont tenus jusqu'à la fin de la transaction :
    -- une autre réservation ne peut pas les reprendre pendant la vérification.
    perform 1 from verrou_place
     where seance_id = v_seance and place_id = any (v_commande.places)
       for update;

    if exists (select 1 from unnest(v_commande.places) as p(place_id)
               where exists (select 1 from billet b
                             where b.seance_id = v_seance and b.place_id = p.place_id
                               and b.statut in ('valide', 'utilise'))
                  or exists (select 1 from verrou_place v
                             where v.seance_id = v_seance and v.place_id = p.place_id
                               and v.reservation_id <> v_commande.reservation_id
                               and v.expire_at > now())) then
        perform perdre_places_commande(p_commande, p_paiement);
        return 'places_perdues';
    end if;

    begin
        delete from verrou_place where seance_id = v_seance and place_id = any (v_commande.places);
        insert into billet (reservation_id, seance_id, place_id, salle_id, prix_centimes)
        select v_commande.reservation_id, v_seance, p, v_salle, v_prix
          from unnest(v_commande.places) as p;
    exception
        when unique_violation then
            -- vendue au même instant par une autre confirmation : rien n'est créé
            perform perdre_places_commande(p_commande, p_paiement);
            return 'places_perdues';
    end;

    update commande
       set statut = 'payee', paye_at = now(), prestataire_paiement_id = p_paiement
     where id = p_commande;
    update reservation
       set statut = 'confirmee', confirmee_at = now()
     where id = v_commande.reservation_id;
    return 'confirmee';
end $$;

-- Sortie commune des deux cas « places perdues » : commande échouée, réservation
-- expirée, ses éventuels verrous libérés.
create function perdre_places_commande(p_commande uuid, p_paiement text)
returns void
language sql
set search_path = public
as $$
    update commande set statut = 'echouee', prestataire_paiement_id = p_paiement where id = p_commande;
    update reservation set statut = 'expiree'
     where id = (select reservation_id from commande where id = p_commande);
    delete from verrou_place
     where reservation_id = (select reservation_id from commande where id = p_commande);
$$;

comment on function confirmer_commande(uuid, text, integer) is
    'Crée les billets d''une commande payée si ses places sont toujours disponibles ; sinon la commande échoue sans billet.';

-- -----------------------------------------------------------------------------
-- Abandonner une commande (page Stripe expirée, fermée ou remplacée)
-- -----------------------------------------------------------------------------
create function abandonner_commande(p_commande uuid)
returns boolean
language sql
set search_path = public
as $$
    update commande set statut = 'abandonnee'
     where id = p_commande and statut = 'en_attente'
    returning true;
$$;

comment on function abandonner_commande(uuid) is
    'Passe une commande en attente à « abandonnée » ; sans effet sur une commande payée ou échouée.';

-- Même règle que les migrations 0005 et 0007 : seule l'application, côté serveur,
-- appelle ces fonctions.
revoke execute on function ouvrir_commande(uuid) from public;
revoke execute on function confirmer_commande(uuid, text, integer) from public;
revoke execute on function perdre_places_commande(uuid, text) from public;
revoke execute on function abandonner_commande(uuid) from public;
do $$
begin
    if exists (select 1 from pg_roles where rolname = 'anon') then
        execute 'revoke execute on function ouvrir_commande(uuid), confirmer_commande(uuid, text, integer), '
             || 'perdre_places_commande(uuid, text), abandonner_commande(uuid) from anon, authenticated';
        execute 'grant execute on function ouvrir_commande(uuid), confirmer_commande(uuid, text, integer), '
             || 'abandonner_commande(uuid) to service_role';
    end if;
end $$;

commit;
