-- Jeu d'essai : données fictives pour développer et tester. NE PAS charger en production.
-- Usage : psql "$DATABASE_URL" -f db/seeds/jeu_essai.sql
begin;

insert into utilisateur (id, email, nom, prenom, role) values
 ('00000000-0000-0000-0000-000000000001', 'admin@exemple.test',  'Administrateur', 'Test', 'administrateur'),
 ('00000000-0000-0000-0000-000000000002', 'prog@exemple.test',   'Programmateur',  'Test', 'programmateur'),
 ('00000000-0000-0000-0000-000000000003', 'accueil@exemple.test','Accueil',        'Test', 'accueil'),
 ('00000000-0000-0000-0000-000000000004', 'alice@exemple.test',  'Martin',         'Alice','spectateur'),
 ('00000000-0000-0000-0000-000000000005', 'bob@exemple.test',    'Durand',         'Bob',  'spectateur');

insert into genre (nom) values ('Action'), ('Comédie'), ('Drame'), ('Science-fiction'), ('Animation');

insert into film (titre, titre_original, synopsis_fr, duree_minutes, age_minimum, date_sortie) values
 ('Film test A', 'Test movie A', 'Synopsis fictif A.', 120, 0,  current_date - 30),
 ('Film test B', null,           'Synopsis fictif B.', 95,  12, current_date - 10),
 ('Film test C', null,           'Synopsis fictif C.', 150, 16, current_date + 5);

insert into film_genre (film_id, genre_id)
select f.id, g.id from film f, genre g
where (f.titre, g.nom) in (('Film test A','Action'),('Film test A','Science-fiction'),('Film test B','Comédie'),('Film test C','Drame'));

insert into salle (nom, type, modulable) values
 ('Salle test 1', 'premium_imax', false),
 ('Salle test 2', 'standard',     true);

-- Salle 1 : 4 rangées (A-D) x 6 places ; salle 2 : 3 rangées (A-C) x 5 places
insert into place (salle_id, rangee, numero, accessible_pmr, position_x, position_y)
select s.id, chr(64 + r), n, (r = 1 and n in (1, 6)), n, r
from salle s, generate_series(1, 4) r, generate_series(1, 6) n
where s.nom = 'Salle test 1';

insert into place (salle_id, rangee, numero, position_x, position_y)
select s.id, chr(64 + r), n, n, r
from salle s, generate_series(1, 3) r, generate_series(1, 5) n
where s.nom = 'Salle test 2';

insert into seance (film_id, salle_id, debut_at, fin_at, version, prix_centimes, statut)
select f.id, s.id, date_trunc('hour', now()) + interval '1 day' + interval '14 hours',
       date_trunc('hour', now()) + interval '1 day' + interval '16 hours 15 minutes', 'vf', 1250, 'publiee'
from film f, salle s where f.titre = 'Film test A' and s.nom = 'Salle test 1';

insert into seance (film_id, salle_id, debut_at, fin_at, version, prix_centimes, statut)
select f.id, s.id, date_trunc('hour', now()) + interval '1 day' + interval '17 hours',
       date_trunc('hour', now()) + interval '1 day' + interval '18 hours 45 minutes', 'vostfr', 900, 'publiee'
from film f, salle s where f.titre = 'Film test B' and s.nom = 'Salle test 2';

commit;
