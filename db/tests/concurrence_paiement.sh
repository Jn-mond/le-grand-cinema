#!/usr/bin/env bash
# Test de concurrence du paiement : 10 commandes payées au même instant pour la MÊME place
# (cas extrême du paiement tardif). Résultat attendu : un seul billet, une seule commande
# confirmée, les 9 autres refusées (places_perdues) : leur autorisation sera annulée.
# Usage : DATABASE_URL=postgresql://... ./db/tests/concurrence_paiement.sh   (ou variables PG*)
set -euo pipefail
PSQL=(psql ${DATABASE_URL:+"$DATABASE_URL"} -X -q -At -v ON_ERROR_STOP=1)
N=10
PLACE=6

nettoyer() {
  "${PSQL[@]}" -c "delete from billet where seance_id = 1 and place_id = $PLACE;
    delete from commande where reservation_id in
      (select id from reservation where email like 'paiement-%@exemple.test');
    delete from verrou_place where seance_id = 1 and place_id = $PLACE;
    delete from reservation where email like 'paiement-%@exemple.test';"
}
nettoyer
# Commandes créées directement, sans verrou : chaque client croit la place à lui.
"${PSQL[@]}" -c "with r as (
    insert into reservation (seance_id, email)
    select 1, 'paiement-' || g || '@exemple.test' from generate_series(1, $N) g returning id)
  insert into commande (reservation_id, montant_centimes, places)
  select r.id, s.prix_centimes, array[$PLACE]::bigint[] from r, seance s where s.id = 1;"

TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
for i in $(seq 1 $N); do
  ( "${PSQL[@]}" -c "select confirmer_commande(c.id, 'pi_concurrence_$i', c.montant_centimes)
      from commande c join reservation r on r.id = c.reservation_id
      where r.email = 'paiement-$i@exemple.test'" > "$TMP/$i" ) &
done
wait

CONFIRMEES=$(cat "$TMP"/* | grep -c '^confirmee$' || true)
PERDUES=$(cat "$TMP"/* | grep -c '^places_perdues$' || true)
BILLETS=$("${PSQL[@]}" -c "select count(*) from billet where seance_id = 1 and place_id = $PLACE")
nettoyer

echo "Confirmées : $CONFIRMEES — refusées : $PERDUES — billets : $BILLETS"
if [[ "$CONFIRMEES" -eq 1 && "$PERDUES" -eq $((N - 1)) && "$BILLETS" -eq 1 ]]; then echo "OK"; else echo "ÉCHEC"; exit 1; fi
