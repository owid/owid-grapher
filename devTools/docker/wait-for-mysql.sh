#!/usr/bin/env  bash
set -o errexit
set -o pipefail
set -o nounset

: "${DB_NAME:?Need to set DB_NAME non-empty}"
: "${DB_USER:?Need to set DB_USER non-empty}"
: "${DB_PASS:?Need to set DB_PASS non-empty}"
: "${DB_HOST:?Need to set DB_HOST non-empty}"
: "${DB_PORT:?Need to set DB_PORT non-empty}"

printf 'Waiting for MySQL to come up...'
while ! mysql -u$DB_USER -p$DB_PASS -h $DB_HOST --port=$DB_PORT -e 'select 1' $DB_NAME &>/dev/null; do
    printf '.'
    sleep 1
done
printf 'ok\n'
