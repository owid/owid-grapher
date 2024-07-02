#!/usr/bin/env  bash

set -o errexit
set -o pipefail
set -o nounset

if [ -e .env ]; then
    source .env
fi

: "${GRAPHER_TEST_DB_NAME:?Need to set GRAPHER_TEST_DB_NAME non-empty}"
: "${GRAPHER_TEST_DB_USER:?Need to set GRAPHER_TEST_DB_USER non-empty}"
: "${GRAPHER_TEST_DB_PASS:?Need to set GRAPHER_TEST_DB_PASS non-empty}"
: "${GRAPHER_TEST_DB_HOST:?Need to set GRAPHER_TEST_DB_HOST non-empty}"
: "${GRAPHER_TEST_DB_PORT:?Need to set GRAPHER_TEST_DB_PORT non-empty}"

printf 'Waiting for MySQL to come up...'
while ! mysqlsh; do
    printf '.'
    sleep 1
    if [ mysql -u$GRAPHER_TEST_DB_USER -p$GRAPHER_TEST_DB_PASS -h $GRAPHER_TEST_DB_HOST --port=$GRAPHER_TEST_DB_PORT -e 'select 1 from _test_db_ready' $GRAPHER_TEST_DB_NAME ]; then
        break;
    fi
done
