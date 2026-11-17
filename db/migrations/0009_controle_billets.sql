-- =============================================================================
-- Le Grand Cinéma — migration 0009 : contrôle des billets à l'entrée (E5)
-- À appliquer après 0008_paiement.sql.
--
-- Le QR code d'un billet contient son jeton (billet.jeton_qr) : une valeur aléatoire
-- de 122 bits, impossible à deviner, vérifiée en base à chaque passage. Le contrôle
-- est une seule instruction UPDATE … WHERE statut = 'valide' : si deux postes scannent
-- le même billet au même instant, PostgreSQL verrouille la ligne, le second voit le
-- billet déjà utilisé et le refuse. Un billet n'ouvre donc l'entrée qu'une fois.
--
-- Un billet est accepté de 60 minutes avant le début de sa séance jusqu'à la fin de
-- celle-ci, et seulement si la séance n'est pas annulée.
-- =============================================================================

begin;

create function controler_billet(p_jeton text, p_avance interval default interval '60 minutes')
returns table (
    resultat     text,           -- accepte, deja_utilise, annule, seance_annulee, trop_tot, seance_terminee, inconnu
    titre_film   text,
    debut_seance timestamptz,
    nom_salle    text,
    rangee_place text,
    numero_place integer,
    utilise_le   timestamptz
)
language plpgsql
set search_path = public
as $$
declare
    v_billet   billet%rowtype;
    v_resultat text;
    v_debut    timestamptz;
    v_fin      timestamptz;
    v_seance   statut_seance;
begin
    -- 1. Passage atomique de « valide » à « utilisé » : toutes les conditions sont dans le WHERE.
    update billet b
       set statut = 'utilise', utilise_at = now()
      from seance s
     where b.jeton_qr = p_jeton
       and b.statut = 'valide'
       and s.id = b.seance_id
       and s.statut <> 'annulee'
       and now() between s.debut_at - p_avance and s.fin_at
    returning b.* into v_billet;

    if found then
        v_resultat := 'accepte';
    else
        -- 2. Refus : on lit le billet pour expliquer pourquoi, sans rien modifier.
        select b.* into v_billet from billet b where b.jeton_qr = p_jeton;
        if not found then
            return query select 'inconnu'::text, null::text, null::timestamptz, null::text,
                                null::text, null::integer, null::timestamptz;
            return;
        end if;
        select s.debut_at, s.fin_at, s.statut into v_debut, v_fin, v_seance
          from seance s where s.id = v_billet.seance_id;
        v_resultat := case
            when v_billet.statut = 'utilise'     then 'deja_utilise'
            when v_billet.statut = 'annule'      then 'annule'
            when v_seance = 'annulee'            then 'seance_annulee'
            when now() < v_debut - p_avance      then 'trop_tot'
            else 'seance_terminee'
        end;
    end if;

    return query
        select v_resultat, f.titre, s.debut_at, sa.nom, p.rangee, p.numero::integer, v_billet.utilise_at
          from seance s
          join film f  on f.id = s.film_id
          join salle sa on sa.id = s.salle_id
          join place p on p.id = v_billet.place_id
         where s.id = v_billet.seance_id;
end $$;

comment on function controler_billet(text, interval) is
    'Contrôle à l''entrée : marque le billet utilisé s''il est valide et dans le créneau de sa séance, sinon renvoie la raison du refus.';

-- Même règle que les migrations précédentes : seule l'application, côté serveur, appelle la fonction.
revoke execute on function controler_billet(text, interval) from public;
do $$
begin
    if exists (select 1 from pg_roles where rolname = 'anon') then
        execute 'revoke execute on function controler_billet(text, interval) from anon, authenticated';
        execute 'grant execute on function controler_billet(text, interval) to service_role';
    end if;
end $$;

commit;
