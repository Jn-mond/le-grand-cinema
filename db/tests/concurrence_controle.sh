#!/usr/bin/env bash
# Test de concurrence du contrôle à l'entrée : le même billet scanné par 10 postes au même
# instant (billet copié, capture d'écran partagée). Résultat attendu : 1 entrée acceptée,
# 9 refus « déjà utilisé ». À lancer sur une base de test contenant le jeu d'essai.
# Usage : DATABASE_URL=postgresql://... ./db/tests/concurrence_controle.sh   (ou variables PG*)
set -euo pipefail
PSQL=(psql ${DATABASE_URL:+"$DATABASE_URL"} -X -q -At -v ON_ERROR_STOP=1)
N=10
JETON="jeton-concurrence-controle"

nettoyer() {
  "${PSQL[@]}" -c "delete from billet where jeton_qr = '$JETON';
    delete from reservation where email = 'controle@exemple.test';
    delete from seance where prix_centimes = 4242 and salle_id = 2;"
}
nettoyer
# Une séance qui commence dans 30 minutes, un billet valide.
"${PSQL[@]}" -c "with s as (
    insert into seance (film_id, salle_id, debut_at, fin_at, prix_centimes, statut)
    values (1, 2, now() + interval '30 minutes', now() + interval '2 hours 30 minutes', 4242, 'publiee')
    returning id),
  r as (
    insert into reservation (seance_id, email, statut, confirmee_at)
    select id, 'controle@exemple.test', 'confirmee', now() from s returning id, seance_id)
  insert into billet (reservation_id, seance_id, place_id, salle_id, prix_centimes, jeton_qr)
  select r.id, r.seance_id, (select min(id) from place where salle_id = 2), 2, 4242, '$JETON' from r;"

TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
for i in $(seq 1 $N); do
  ( "${PSQL[@]}" -c "select resultat from controler_billet('$JETON')" > "$TMP/$i" ) &
done
wait

ACCEPTES=$(cat "$TMP"/* | grep -c '^accepte$' || true)
REFUSES=$(cat "$TMP"/* | grep -c '^deja_utilise$' || true)
nettoyer

echo "Acceptés : $ACCEPTES — refusés (déjà utilisé) : $REFUSES"
if [[ "$ACCEPTES" -eq 1 && "$REFUSES" -eq $((N - 1)) ]]; then echo "OK"; else echo "ÉCHEC"; exit 1; fi
