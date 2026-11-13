-- =============================================================================
-- Le Grand Cinéma — migration 0002 : ventes au guichet (backlog E8)
-- À appliquer après 0001_modele_initial.sql.
--
-- Constat : la migration 0001 impose une adresse e-mail à toute réservation.
-- Or le personnel d'accueil vend au guichet sur le même stock de places que le
-- site, sans forcément connaître l'e-mail du client (EPIC E8, profil U4).
--
-- Changement : chaque réservation a un canal (en ligne ou guichet).
--  - en ligne : l'e-mail reste obligatoire (il sert à envoyer et retrouver les billets) ;
--  - guichet  : l'e-mail est facultatif, et le vendeur (membre du personnel) est obligatoire.
-- Les réservations existantes sont toutes en ligne : elles restent valides.
-- =============================================================================

begin;

create type canal_reservation as enum ('en_ligne', 'guichet');

alter table reservation
    add column canal      canal_reservation not null default 'en_ligne',
    add column vendeur_id uuid references utilisateur (id) on delete restrict,
    alter column email drop not null;

alter table reservation drop constraint reservation_email_format;

alter table reservation
    add constraint reservation_email_coherent check (
        (canal = 'en_ligne' and email is not null and email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')
     or (canal = 'guichet'  and (email is null or email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'))
    ),
    add constraint reservation_vendeur_coherent check ((canal = 'guichet') = (vendeur_id is not null));

create index reservation_vendeur_idx on reservation (vendeur_id) where vendeur_id is not null;

comment on column reservation.canal      is 'Origine de la réservation : en ligne (site) ou guichet (vente par le personnel d''accueil).';
comment on column reservation.vendeur_id is 'Membre du personnel qui a vendu la réservation ; renseigné si et seulement si le canal est « guichet ».';
comment on column reservation.email      is 'Adresse e-mail du client : obligatoire en ligne, facultative au guichet.';

commit;
