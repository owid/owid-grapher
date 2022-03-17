#!/usr/bin/env  bash
set -o errexit
set -o pipefail
set -o nounset

DB_NAME=grapher
DB_USER=grapher
DB_PASS=grapher

: "${DB_HOST:?Need to set DB_HOST non-empty}"

printf 'Waiting for MySQL to come up...'
while ! mysql -u$DB_USER -p$DB_PASS -h $DB_HOST -e 'select 1' $DB_NAME &>/dev/null; do
    printf '.'
    sleep 1
done
printf 'ok\n'
