-- Tests des règles d'intégrité. À lancer APRÈS les migrations (0001 à 0005) et le jeu d'essai, sur une base de test :
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/tests/contraintes.sql
-- Tout est exécuté dans une transaction annulée à la fin : la base n'est pas modifiée.
begin;

create temp table resultats (test text, ok boolean);

-- Vérifie qu'une instruction SQL échoue avec le code SQLSTATE attendu.
create function pg_temp.doit_echouer(p_test text, p_sql text, p_etat text) returns void language plpgsql as $$
begin
    begin
        execute p_sql;
        insert into resultats values (p_test, false);
    exception when others then
        insert into resultats values (p_test, sqlstate = p_etat);
    end;
end $$;

-- Vérifie qu'une expression booléenne est vraie.
create function pg_temp.doit_etre_vrai(p_test text, p_sql text) returns void language plpgsql as $$
declare v boolean;
begin
    execute p_sql into v;
    insert into resultats values (p_test, coalesce(v, false));
end $$;

-- Réservations de test
insert into reservation (id, seance_id, email) values
 ('10000000-0000-0000-0000-000000000001', 1, 'a@exemple.test'),
 ('10000000-0000-0000-0000-000000000002', 1, 'b@exemple.test'),
 ('10000000-0000-0000-0000-000000000003', 2, 'c@exemple.test');

-- T1..T3 : utilisateurs
select pg_temp.doit_echouer('T1 e-mail invalide refusé',
  $q$insert into utilisateur (email, nom, prenom) values ('pas-un-email','X','Y')$q$, '23514');
select pg_temp.doit_echouer('T2 e-mail en double refusé (insensible à la casse)',
  $q$insert into utilisateur (email, nom, prenom) values ('ALICE@exemple.test','X','Y')$q$, '23505');
select pg_temp.doit_echouer('T3 rôle inconnu refusé',
  $q$insert into utilisateur (email, nom, prenom, role) values ('z@exemple.test','X','Y','inconnu')$q$, '22P02');

-- T4..T6 : films, places
select pg_temp.doit_echouer('T4 durée de film nulle refusée',
  $q$insert into film (titre, duree_minutes) values ('X', 0)$q$, '23514');
select pg_temp.doit_echouer('T5 âge minimum non réglementaire refusé',
  $q$insert into film (titre, duree_minutes, age_minimum) values ('X', 90, 14)$q$, '23514');
select pg_temp.doit_echouer('T6 place en double dans une salle refusée',
  $q$insert into place (salle_id, rangee, numero) values (1, 'A', 1)$q$, '23505');

-- T7..T9 : séances
select pg_temp.doit_echouer('T7 séance qui finit avant son début refusée',
  $q$insert into seance (film_id, salle_id, debut_at, fin_at, prix_centimes)
     values (1, 1, now() + interval '3 days', now() + interval '2 days', 1000)$q$, '23514');
select pg_temp.doit_echouer('T8 chevauchement de séances dans une salle refusé',
  $q$insert into seance (film_id, salle_id, debut_at, fin_at, prix_centimes, statut)
     select 2, salle_id, debut_at + interval '30 minutes', fin_at + interval '30 minutes', 1000, 'publiee' from seance where id = 1$q$, '23P01');
select pg_temp.doit_echouer('T9 prix négatif refusé',
  $q$insert into seance (film_id, salle_id, debut_at, fin_at, prix_centimes)
     values (1, 1, now() + interval '5 days', now() + interval '5 days 2 hours', -1)$q$, '23514');

-- T10 : une séance annulée ne bloque pas la salle
update seance set statut = 'annulee' where id = 1;
select pg_temp.doit_etre_vrai('T10 salle libre après annulation d''une séance',
  $q$with ins as (insert into seance (film_id, salle_id, debut_at, fin_at, prix_centimes, statut)
       select 2, salle_id, debut_at, fin_at, 1000, 'publiee' from seance where id = 1 returning 1)
     select count(*) = 1 from ins$q$);
-- On remet la séance 1 en état et on supprime la séance de test créée pour T10
delete from seance where id > 2;
update seance set statut = 'publiee' where id = 1;

-- T11..T13 : verrous
select pg_temp.doit_etre_vrai('T11 pose d''un verrou sur une place libre',
  $q$select poser_verrou('10000000-0000-0000-0000-000000000001', 1)$q$);
select pg_temp.doit_etre_vrai('T12 le même verrou peut être renouvelé par la même réservation',
  $q$select poser_verrou('10000000-0000-0000-0000-000000000001', 1)$q$);
select pg_temp.doit_etre_vrai('T13 place verrouillée refusée à une autre réservation',
  $q$select not poser_verrou('10000000-0000-0000-0000-000000000002', 1)$q$);
select pg_temp.doit_etre_vrai('T14 place d''une autre salle refusée',
  $q$select not poser_verrou('10000000-0000-0000-0000-000000000001', 30)$q$);
select pg_temp.doit_etre_vrai('T15 vue : 1 place verrouillée, 23 libres',
  $q$select count(*) filter (where etat = 'verrouillee') = 1 and count(*) filter (where etat = 'libre') = 23
     from vue_places_seance where seance_id = 1$q$);

-- T16..T17 : expiration
update verrou_place set expire_at = now() - interval '1 second' where seance_id = 1 and place_id = 1;
select pg_temp.doit_etre_vrai('T16 un verrou expiré est écrasé par une autre réservation',
  $q$select poser_verrou('10000000-0000-0000-0000-000000000002', 1)$q$);
update verrou_place set expire_at = now() - interval '1 second' where seance_id = 1 and place_id = 1;
select pg_temp.doit_etre_vrai('T17 la tâche de nettoyage libère 1 verrou',
  $q$select liberer_verrous_expires() = 1$q$);

-- T18..T22 : billets
select poser_verrou('10000000-0000-0000-0000-000000000001', 2);
insert into billet (reservation_id, seance_id, place_id, salle_id, prix_centimes)
  values ('10000000-0000-0000-0000-000000000001', 1, 2, 1, 1250);
select pg_temp.doit_echouer('T18 place déjà vendue : second billet refusé',
  $q$insert into billet (reservation_id, seance_id, place_id, salle_id, prix_centimes)
     values ('10000000-0000-0000-0000-000000000002', 1, 2, 1, 1250)$q$, '23505');
select pg_temp.doit_etre_vrai('T19 place vendue : poser_verrou refuse',
  $q$select not poser_verrou('10000000-0000-0000-0000-000000000002', 2)$q$);
select pg_temp.doit_echouer('T20 verrou direct sur place vendue refusé (trigger)',
  $q$insert into verrou_place (seance_id, place_id, salle_id, reservation_id, expire_at)
     values (1, 2, 1, '10000000-0000-0000-0000-000000000002', now() + interval '10 minutes')$q$, '23505');
select pg_temp.doit_echouer('T21 billet sur une place d''une autre salle refusé',
  $q$insert into billet (reservation_id, seance_id, place_id, salle_id, prix_centimes)
     values ('10000000-0000-0000-0000-000000000002', 1, 30, 1, 1250)$q$, '23503');
select pg_temp.doit_echouer('T22 billet rattaché à la réservation d''une autre séance refusé',
  $q$insert into billet (reservation_id, seance_id, place_id, salle_id, prix_centimes)
     values ('10000000-0000-0000-0000-000000000003', 1, 3, 1, 1250)$q$, '23503');

-- T23 : une place annulée peut être revendue
-- À la confirmation, l'application supprime le verrou : on le reproduit ici.
delete from verrou_place where seance_id = 1 and place_id = 2;
update billet set statut = 'annule' where place_id = 2 and seance_id = 1;
select pg_temp.doit_etre_vrai('T23 place libérée après annulation du billet',
  $q$select poser_verrou('10000000-0000-0000-0000-000000000002', 2)$q$);

-- T24..T26 : réservations et commandes
select pg_temp.doit_echouer('T24 réservation confirmée sans date refusée',
  $q$insert into reservation (seance_id, email, statut) values (1, 'd@exemple.test', 'confirmee')$q$, '23514');
insert into commande (reservation_id, montant_centimes, statut, paye_at)
  values ('10000000-0000-0000-0000-000000000001', 1250, 'payee', now());
select pg_temp.doit_echouer('T25 deux commandes payées pour une réservation refusé',
  $q$insert into commande (reservation_id, montant_centimes, statut, paye_at)
     values ('10000000-0000-0000-0000-000000000001', 1250, 'payee', now())$q$, '23505');
select pg_temp.doit_echouer('T26 commande « payée » sans date refusée',
  $q$insert into commande (reservation_id, montant_centimes, statut) values ('10000000-0000-0000-0000-000000000002', 1, 'payee')$q$, '23514');

-- T27 : suppression protégée
select pg_temp.doit_echouer('T27 suppression d''un film programmé refusée',
  $q$delete from film where id = 1$q$, '23503');

-- T28 : taux de remplissage
delete from verrou_place where seance_id = 1 and place_id = 2;
update billet set statut = 'valide' where place_id = 2 and seance_id = 1;
select pg_temp.doit_etre_vrai('T28 taux de remplissage : 1 place sur 24 = 4,17 %',
  $q$select taux_remplissage_pct = 4.17 from vue_remplissage_seance where seance_id = 1$q$);

-- T29..T33 : ventes au guichet (migration 0002)
insert into reservation (seance_id, email, canal, vendeur_id)
  values (1, null, 'guichet', '00000000-0000-0000-0000-000000000003');
select pg_temp.doit_etre_vrai('T29 vente au guichet sans e-mail acceptée',
  $q$select count(*) = 1 from reservation where canal = 'guichet' and email is null$q$);
select pg_temp.doit_echouer('T30 réservation en ligne sans e-mail refusée',
  $q$insert into reservation (seance_id, email) values (1, null)$q$, '23514');
select pg_temp.doit_echouer('T31 vente au guichet sans vendeur refusée',
  $q$insert into reservation (seance_id, canal) values (1, 'guichet')$q$, '23514');
select pg_temp.doit_echouer('T32 réservation en ligne avec vendeur refusée',
  $q$insert into reservation (seance_id, email, vendeur_id) values (1, 'e@exemple.test', '00000000-0000-0000-0000-000000000003')$q$, '23514');
select pg_temp.doit_echouer('T33 e-mail invalide refusé même au guichet',
  $q$insert into reservation (seance_id, email, canal, vendeur_id) values (1, 'pas-un-email', 'guichet', '00000000-0000-0000-0000-000000000003')$q$, '23514');

-- T34..T38 : référence, nom du client et recherche (migration 0003)
insert into reservation (id, seance_id, email, nom_client, canal, vendeur_id)
  values ('10000000-0000-0000-0000-000000000009', 1, null, 'Dupont Marie', 'guichet', '00000000-0000-0000-0000-000000000003');
select pg_temp.doit_etre_vrai('T34 chaque réservation reçoit une référence au bon format',
  $q$select bool_and(reference ~ '^LGC-[A-HJ-NP-Z2-9]{6}$') and count(distinct reference) = count(*) from reservation$q$);
select pg_temp.doit_echouer('T35 référence en double refusée',
  $q$insert into reservation (seance_id, email, reference)
     select 1, 'dup@exemple.test', reference from reservation limit 1$q$, '23505');
select pg_temp.doit_echouer('T36 nom de client vide refusé',
  $q$insert into reservation (seance_id, email, nom_client) values (1, 'v@exemple.test', '   ')$q$, '23514');
select pg_temp.doit_etre_vrai('T37 recherche par début de nom (sans tenir compte des majuscules)',
  $q$select count(*) = 1 from rechercher_reservations('dupont')$q$);
select pg_temp.doit_etre_vrai('T38 recherche par référence et par e-mail',
  $q$select (select count(*) from rechercher_reservations((select reference from reservation where id = '10000000-0000-0000-0000-000000000001'))) = 1
        and (select count(*) from rechercher_reservations('A@EXEMPLE.TEST')) = 1$q$);

-- T39..T41 : le verrou ne se prolonge pas (migration 0004, correctif E3)
insert into reservation (id, seance_id, email) values ('10000000-0000-0000-0000-00000000000b', 1, 'delai@exemple.test');
select poser_verrou('10000000-0000-0000-0000-00000000000b', 10);
update verrou_place set expire_at = now() + interval '1 minute' where seance_id = 1 and place_id = 10;
select pg_temp.doit_etre_vrai('T39 un appel répété ne repousse pas l''échéance du verrou',
  $q$select poser_verrou('10000000-0000-0000-0000-00000000000b', 10)
        and (select expire_at = now() + interval '1 minute' from verrou_place where seance_id = 1 and place_id = 10)$q$);
update reservation set cree_at = now() - interval '11 minutes' where id = '10000000-0000-0000-0000-00000000000b';
select pg_temp.doit_etre_vrai('T40 une réservation de plus de 10 minutes ne peut plus verrouiller de place',
  $q$select not poser_verrou('10000000-0000-0000-0000-00000000000b', 11)$q$);
update verrou_place set expire_at = now() - interval '1 second' where seance_id = 1 and place_id = 10;
select pg_temp.doit_etre_vrai('T41 une réservation périmée ne peut pas reprendre son verrou expiré',
  $q$select not poser_verrou('10000000-0000-0000-0000-00000000000b', 10)$q$);

-- T42..T45 : verrouillage de plusieurs places, tout ou rien (migration 0005)
-- L'appel et la vérification sont dans deux requêtes distinctes : une sous-requête de la
-- même instruction ne verrait pas les verrous que la fonction vient de poser.
insert into reservation (id, seance_id, email) values
 ('10000000-0000-0000-0000-00000000000c', 1, 'groupe1@exemple.test'),
 ('10000000-0000-0000-0000-00000000000d', 1, 'groupe2@exemple.test');
create temp table refus as
  select 'T42'::text as test, poser_verrous('10000000-0000-0000-0000-00000000000c', array[14, 12, 13]) as places;
select pg_temp.doit_etre_vrai('T42 plusieurs places libres : toutes verrouillées, aucun refus',
  $q$select (select cardinality(places) = 0 from refus where test = 'T42')
        and (select count(*) = 3 from verrou_place
             where reservation_id = '10000000-0000-0000-0000-00000000000c')$q$);
insert into refus select 'T43', poser_verrous('10000000-0000-0000-0000-00000000000d', array[15, 13, 16]);
select pg_temp.doit_etre_vrai('T43 une place déjà prise : refus signalé et aucune place verrouillée',
  $q$select (select places = array[13]::bigint[] from refus where test = 'T43')
        and not exists (select 1 from verrou_place
                        where reservation_id = '10000000-0000-0000-0000-00000000000d')
        and exists (select 1 from vue_places_seance where seance_id = 1 and place_id = 15 and etat = 'libre')$q$);
insert into refus select 'T44', poser_verrous('10000000-0000-0000-0000-00000000000d', array[17, 17]);
select pg_temp.doit_etre_vrai('T44 une place demandée deux fois n''est verrouillée qu''une fois',
  $q$select (select cardinality(places) = 0 from refus where test = 'T44')
        and (select count(*) = 1 from verrou_place
             where reservation_id = '10000000-0000-0000-0000-00000000000d' and place_id = 17)$q$);
insert into refus select 'T45', poser_verrous('10000000-0000-0000-0000-00000000000d', '{}');
select pg_temp.doit_etre_vrai('T45 liste vide : aucun effet',
  $q$select (select cardinality(places) = 0 from refus where test = 'T45')
        and (select count(*) = 1 from verrou_place
             where reservation_id = '10000000-0000-0000-0000-00000000000d')$q$);

-- Rapport
select test, case when ok then 'OK' else 'ÉCHEC' end as resultat from resultats order by test;
do $$
begin
    if exists (select 1 from resultats where not ok) then
        raise exception 'Au moins un test a échoué';
    end if;
end $$;

rollback;
