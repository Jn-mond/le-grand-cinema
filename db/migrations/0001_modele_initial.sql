-- =============================================================================
-- Le Grand Cinéma — modèle de données initial
-- SGBD : PostgreSQL 15 ou plus (testé sur 16) ; compatible Supabase.
-- Exécution : psql "$DATABASE_URL" -f db/migrations/0001_modele_initial.sql
--             ou copier-coller dans l'éditeur SQL de Supabase.
--
-- Conventions : noms de tables et de colonnes en français, snake_case, sans
-- accents ; montants en centimes d'euro (entiers, jamais de décimaux) ;
-- horodatages en timestamptz (UTC) ; clés uuid pour les données personnelles
-- ou sensibles, clés entières pour les référentiels.
-- Les identifiants de connexion (mots de passe) ne sont pas stockés ici : ils
-- relèvent du service d'authentification. utilisateur.id est l'identifiant
-- d'authentification.
-- =============================================================================

begin;

create extension if not exists btree_gist;   -- interdit le chevauchement de séances dans une salle

-- -----------------------------------------------------------------------------
-- Types énumérés
-- -----------------------------------------------------------------------------
create type role_utilisateur   as enum ('spectateur', 'professionnel', 'accueil', 'programmateur', 'administrateur');
create type type_salle         as enum ('premium_imax', 'standard', 'vip', 'evenementielle');
create type version_seance     as enum ('vf', 'vostfr', 'vo');
create type statut_seance      as enum ('brouillon', 'publiee', 'annulee');
create type statut_reservation as enum ('en_attente_paiement', 'confirmee', 'annulee', 'expiree');
create type statut_commande    as enum ('en_attente', 'payee', 'echouee', 'abandonnee');
create type statut_billet      as enum ('valide', 'utilise', 'annule');

-- -----------------------------------------------------------------------------
-- Utilisateurs
-- Un spectateur peut réserver sans compte (réservation « invité » : voir
-- reservation.email). Cette table contient les comptes et le personnel.
-- -----------------------------------------------------------------------------
create table utilisateur (
    id          uuid primary key default gen_random_uuid(),
    email       text        not null,
    nom         text        not null,
    prenom      text        not null,
    telephone   text,
    role        role_utilisateur not null default 'spectateur',
    langue      char(2)     not null default 'fr',
    actif       boolean     not null default true,
    cree_at     timestamptz not null default now(),
    constraint utilisateur_email_format check (email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
    constraint utilisateur_langue_valide check (langue in ('fr', 'en'))
);
create unique index utilisateur_email_unique on utilisateur (lower(email));

-- -----------------------------------------------------------------------------
-- Films
-- -----------------------------------------------------------------------------
create table genre (
    id   smallint generated always as identity primary key,
    nom  text not null unique
);

create table film (
    id              bigint generated always as identity primary key,
    titre           text     not null,
    titre_original  text,
    synopsis_fr     text,
    synopsis_en     text,
    duree_minutes   smallint not null,
    age_minimum     smallint not null default 0,
    date_sortie     date,
    affiche_url     text,
    actif           boolean  not null default true,
    cree_at         timestamptz not null default now(),
    constraint film_duree_valide check (duree_minutes between 1 and 600),
    constraint film_age_valide   check (age_minimum in (0, 10, 12, 16, 18))
);

create table film_genre (
    film_id   bigint   not null references film (id)  on delete cascade,
    genre_id  smallint not null references genre (id) on delete restrict,
    primary key (film_id, genre_id)
);

-- -----------------------------------------------------------------------------
-- Salles et places
-- La capacité d'une salle est le nombre de ses places actives (voir la vue
-- vue_remplissage_seance) : elle n'est pas dupliquée dans une colonne.
-- -----------------------------------------------------------------------------
create table salle (
    id         bigint generated always as identity primary key,
    nom        text       not null unique,
    type       type_salle not null,
    modulable  boolean    not null default false,
    actif      boolean    not null default true
);

create table place (
    id             bigint generated always as identity primary key,
    salle_id       bigint   not null references salle (id) on delete cascade,
    rangee         text     not null,
    numero         smallint not null,
    accessible_pmr boolean  not null default false,
    position_x     smallint,
    position_y     smallint,
    actif          boolean  not null default true,
    constraint place_rangee_valide check (rangee ~ '^[A-Z]{1,2}$'),
    constraint place_numero_valide check (numero > 0),
    constraint place_unique_dans_salle unique (salle_id, rangee, numero),
    constraint place_id_salle_unique unique (id, salle_id)      -- cible des clés étrangères composites
);

-- -----------------------------------------------------------------------------
-- Séances
-- fin_at = début + durée du film + temps de nettoyage (calculé par l'application
-- de programmation). Une salle ne peut pas accueillir deux séances qui se
-- chevauchent, sauf si l'une est annulée.
-- -----------------------------------------------------------------------------
create table seance (
    id             bigint generated always as identity primary key,
    film_id        bigint        not null references film (id)  on delete restrict,
    salle_id       bigint        not null references salle (id) on delete restrict,
    debut_at       timestamptz   not null,
    fin_at         timestamptz   not null,
    version        version_seance not null default 'vf',
    prix_centimes  integer       not null,
    statut         statut_seance not null default 'brouillon',
    cree_at        timestamptz   not null default now(),
    constraint seance_horaires_valides check (fin_at > debut_at),
    constraint seance_prix_valide      check (prix_centimes >= 0),
    constraint seance_id_salle_unique  unique (id, salle_id),   -- cible des clés étrangères composites
    constraint seance_pas_de_chevauchement
        exclude using gist (salle_id with =, tstzrange(debut_at, fin_at) with &&)
        where (statut <> 'annulee')
);
create index seance_debut_idx on seance (debut_at);
create index seance_film_idx  on seance (film_id);

-- -----------------------------------------------------------------------------
-- Réservations
-- Une réservation regroupe des places pour une séance. Elle est créée en
-- attente de paiement, puis confirmée quand le paiement est reçu. Sans compte,
-- utilisateur_id reste vide et l'adresse e-mail permet de retrouver les billets.
-- -----------------------------------------------------------------------------
create table reservation (
    id              uuid primary key default gen_random_uuid(),
    seance_id       bigint             not null references seance (id) on delete restrict,
    utilisateur_id  uuid               references utilisateur (id) on delete set null,
    email           text               not null,
    statut          statut_reservation not null default 'en_attente_paiement',
    cree_at         timestamptz        not null default now(),
    confirmee_at    timestamptz,
    constraint reservation_email_format check (email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
    constraint reservation_confirmation_coherente check ((statut = 'confirmee') = (confirmee_at is not null)),
    constraint reservation_id_seance_unique unique (id, seance_id)   -- cible des clés étrangères composites
);
create index reservation_email_idx       on reservation (lower(email));
create index reservation_seance_idx      on reservation (seance_id);
create index reservation_utilisateur_idx on reservation (utilisateur_id);

-- -----------------------------------------------------------------------------
-- Commandes (paiements)
-- Une commande correspond à une tentative de paiement chez le prestataire.
-- Une réservation peut en avoir plusieurs (échec puis nouvel essai), mais une
-- seule peut être payée.
-- -----------------------------------------------------------------------------
create table commande (
    id                      uuid primary key default gen_random_uuid(),
    reservation_id          uuid            not null references reservation (id) on delete restrict,
    montant_centimes        integer         not null,
    devise                  char(3)         not null default 'EUR',
    statut                  statut_commande not null default 'en_attente',
    prestataire_session_id  text            unique,
    prestataire_paiement_id text            unique,
    cree_at                 timestamptz     not null default now(),
    paye_at                 timestamptz,
    constraint commande_montant_valide check (montant_centimes >= 0),
    constraint commande_paiement_coherent check ((statut = 'payee') = (paye_at is not null))
);
create index commande_reservation_idx on commande (reservation_id);
create unique index commande_une_seule_payee on commande (reservation_id) where statut = 'payee';

-- Événements reçus du prestataire de paiement : permet de traiter chaque
-- webhook une seule fois (idempotence). Table technique, sans clé étrangère.
create table evenement_paiement (
    id         text primary key,          -- identifiant d'événement fourni par le prestataire
    type       text        not null,
    recu_at    timestamptz not null default now(),
    traite_at  timestamptz
);

-- -----------------------------------------------------------------------------
-- Verrous de place (blocage temporaire pendant le paiement)
-- La clé primaire (séance, place) garantit qu'une place n'est verrouillée que
-- par une seule réservation à la fois. salle_id est dupliqué pour que les clés
-- étrangères composites garantissent que la place appartient bien à la salle de
-- la séance.
-- -----------------------------------------------------------------------------
create table verrou_place (
    seance_id       bigint      not null,
    place_id        bigint      not null,
    salle_id        bigint      not null,
    reservation_id  uuid        not null,
    expire_at       timestamptz not null,
    cree_at         timestamptz not null default now(),
    primary key (seance_id, place_id),
    foreign key (seance_id, salle_id)       references seance (id, salle_id),
    foreign key (place_id, salle_id)        references place (id, salle_id),
    foreign key (reservation_id, seance_id) references reservation (id, seance_id) on delete cascade
);
create index verrou_expiration_idx  on verrou_place (expire_at);
create index verrou_reservation_idx on verrou_place (reservation_id);

-- -----------------------------------------------------------------------------
-- Billets (une place vendue = un billet)
-- L'index unique partiel est la garantie finale « aucune place vendue deux
-- fois » : il porte sur les billets valides ou utilisés, pas sur les annulés.
-- -----------------------------------------------------------------------------
create table billet (
    id              uuid primary key default gen_random_uuid(),
    reservation_id  uuid          not null,
    seance_id       bigint        not null,
    place_id        bigint        not null,
    salle_id        bigint        not null,
    jeton_qr        text          not null unique default gen_random_uuid()::text,
    prix_centimes   integer       not null,
    statut          statut_billet not null default 'valide',
    utilise_at      timestamptz,
    cree_at         timestamptz   not null default now(),
    constraint billet_prix_valide check (prix_centimes >= 0),
    constraint billet_utilisation_coherente check ((statut = 'utilise') = (utilise_at is not null)),
    foreign key (reservation_id, seance_id) references reservation (id, seance_id) on delete restrict,
    foreign key (seance_id, salle_id)       references seance (id, salle_id),
    foreign key (place_id, salle_id)        references place (id, salle_id)
);
create unique index billet_place_vendue_une_fois on billet (seance_id, place_id) where statut in ('valide', 'utilise');
create index billet_reservation_idx on billet (reservation_id);

-- Sécurité complémentaire : une place déjà vendue ne peut pas être verrouillée,
-- même si l'insertion ne passe pas par la fonction poser_verrou().
create function verifier_verrou_place() returns trigger language plpgsql as $$
begin
    if exists (select 1 from billet b
               where b.seance_id = new.seance_id and b.place_id = new.place_id
                 and b.statut in ('valide', 'utilise')) then
        raise exception 'La place % de la séance % est déjà vendue', new.place_id, new.seance_id
            using errcode = 'unique_violation';
    end if;
    return new;
end $$;

create trigger verrou_place_verifier
    before insert or update on verrou_place
    for each row execute function verifier_verrou_place();

-- -----------------------------------------------------------------------------
-- Fonctions métier
-- -----------------------------------------------------------------------------

-- Pose (ou renouvelle) le verrou d'une place pour une réservation.
-- Retourne true si la place est verrouillée pour cette réservation, false sinon
-- (place déjà verrouillée par un autre, déjà vendue, séance non réservable, place
-- d'une autre salle). Un verrou expiré est écrasé sans attendre la tâche de
-- nettoyage.
create function poser_verrou(p_reservation uuid, p_place bigint, p_duree interval default interval '10 minutes')
returns boolean language plpgsql as $$
declare
    v_seance bigint;
    v_salle  bigint;
    v_ok     boolean;
begin
    select r.seance_id, s.salle_id into v_seance, v_salle
    from reservation r
    join seance s on s.id = r.seance_id
    where r.id = p_reservation
      and r.statut = 'en_attente_paiement'
      and s.statut = 'publiee'
      and s.debut_at > now();
    if not found then
        return false;
    end if;

    insert into verrou_place (seance_id, place_id, salle_id, reservation_id, expire_at)
    select v_seance, p_place, v_salle, p_reservation, now() + p_duree
    where not exists (select 1 from billet b
                      where b.seance_id = v_seance and b.place_id = p_place
                        and b.statut in ('valide', 'utilise'))
    on conflict (seance_id, place_id) do update
        set reservation_id = excluded.reservation_id,
            expire_at      = excluded.expire_at,
            cree_at        = now()
        where verrou_place.expire_at <= now()
           or verrou_place.reservation_id = excluded.reservation_id
    returning true into v_ok;

    return coalesce(v_ok, false);
exception
    when foreign_key_violation then
        return false;               -- la place n'appartient pas à la salle de la séance
end $$;

-- Tâche planifiée : supprime les verrous expirés. Retourne le nombre de places libérées.
create function liberer_verrous_expires() returns integer language sql as $$
    with supprimes as (
        delete from verrou_place where expire_at <= now() returning 1
    )
    select count(*)::integer from supprimes;
$$;

-- -----------------------------------------------------------------------------
-- Vues
-- -----------------------------------------------------------------------------

-- État de chaque place pour chaque séance : alimente le plan de salle.
create view vue_places_seance as
select s.id as seance_id,
       p.id as place_id,
       p.rangee,
       p.numero,
       p.accessible_pmr,
       p.position_x,
       p.position_y,
       case
           when exists (select 1 from billet b
                        where b.seance_id = s.id and b.place_id = p.id
                          and b.statut in ('valide', 'utilise')) then 'vendue'
           when exists (select 1 from verrou_place v
                        where v.seance_id = s.id and v.place_id = p.id
                          and v.expire_at > now()) then 'verrouillee'
           else 'libre'
       end as etat
from seance s
join place p on p.salle_id = s.salle_id and p.actif;

-- Taux de remplissage = places occupées / places offertes.
create view vue_remplissage_seance as
select s.id as seance_id,
       s.film_id,
       s.salle_id,
       s.debut_at,
       o.places_offertes,
       v.places_occupees,
       round(100.0 * v.places_occupees / nullif(o.places_offertes, 0), 2) as taux_remplissage_pct
from seance s
cross join lateral (select count(*) as places_offertes
                    from place p where p.salle_id = s.salle_id and p.actif) o
cross join lateral (select count(*) as places_occupees
                    from billet b where b.seance_id = s.id and b.statut in ('valide', 'utilise')) v;

-- -----------------------------------------------------------------------------
-- Commentaires (visibles dans les outils d'administration)
-- -----------------------------------------------------------------------------
comment on table utilisateur        is 'Comptes et personnel. Les identifiants de connexion relèvent du service d''authentification.';
comment on table film               is 'Catalogue des films.';
comment on table genre              is 'Genres de films (référentiel).';
comment on table film_genre         is 'Association film - genre (plusieurs genres par film).';
comment on table salle              is 'Salles du cinéma. La capacité = nombre de places actives.';
comment on table place              is 'Siège identifié d''une salle (rangée + numéro).';
comment on table seance             is 'Projection d''un film dans une salle à une date et une heure données.';
comment on table reservation        is 'Ensemble de places pour une séance ; invité (sans compte) ou rattaché à un utilisateur.';
comment on table commande           is 'Tentative de paiement associée à une réservation.';
comment on table evenement_paiement is 'Événements du prestataire de paiement déjà reçus (idempotence des webhooks).';
comment on table verrou_place       is 'Blocage temporaire (10 minutes) d''une place pendant le paiement.';
comment on table billet             is 'Justificatif dématérialisé d''une place vendue (QR code à usage unique).';

commit;
