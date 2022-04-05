#!/usr/bin/env  bash
set -o errexit
set -o pipefail
set -o nounset

: "${GRAPHER_DB_NAME:?Need to set GRAPHER_DB_NAME non-empty}"
: "${GRAPHER_DB_USER:?Need to set GRAPHER_DB_USER non-empty}"
: "${GRAPHER_DB_PASS:?Need to set GRAPHER_DB_PASS non-empty}"
: "${GRAPHER_DB_HOST:?Need to set GRAPHER_DB_HOST non-empty}"
: "${GRAPHER_DB_PORT:?Need to set GRAPHER_DB_PORT non-empty}"

printf 'Waiting for MySQL to come up...'
while ! mysql -u$GRAPHER_DB_USER -p$GRAPHER_DB_PASS -h $GRAPHER_DB_HOST --port=$GRAPHER_DB_PORT -e 'select 1' $GRAPHER_DB_NAME &>/dev/null; do
    printf '.'
    sleep 1
done
printf 'ok\n'
