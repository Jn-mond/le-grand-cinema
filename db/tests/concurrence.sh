#!/usr/bin/env bash
# Test de concurrence : 20 clients tentent de verrouiller la MÊME place en même temps.
# Résultat attendu : exactement 1 succès. À lancer sur une base de test contenant le jeu d'essai.
# Usage : DATABASE_URL=postgresql://... ./db/tests/concurrence.sh      (ou variables PG* habituelles)
set -euo pipefail
PSQL=(psql ${DATABASE_URL:+"$DATABASE_URL"} -X -q -At -v ON_ERROR_STOP=1)
N=20
PLACE=5

"${PSQL[@]}" -c "delete from verrou_place where seance_id = 1 and place_id = $PLACE;
  delete from reservation where email like 'concurrence-%@exemple.test';
  insert into reservation (seance_id, email)
  select 1, 'concurrence-' || g || '@exemple.test' from generate_series(1, $N) g;"

TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
for i in $(seq 1 $N); do
  ( "${PSQL[@]}" -c "select poser_verrou(id, $PLACE) from reservation where email = 'concurrence-$i@exemple.test'" > "$TMP/$i" ) &
done
wait

GAGNANTS=$(cat "$TMP"/* | grep -c '^t$' || true)
LIGNES=$("${PSQL[@]}" -c "select count(*) from verrou_place where seance_id = 1 and place_id = $PLACE")
"${PSQL[@]}" -c "delete from verrou_place where seance_id = 1 and place_id = $PLACE;
  delete from reservation where email like 'concurrence-%@exemple.test';"

echo "Succès : $GAGNANTS sur $N — verrous en base : $LIGNES"
if [ "$GAGNANTS" -eq 1 ] && [ "$LIGNES" -eq 1 ]; then echo "OK"; else echo "ÉCHEC"; exit 1; fi
