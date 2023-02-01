#!/usr/bin/env  bash
#
#  mark-test-mysql-dirty.sh
#
#  Remove the _test_db_ready table from the test database, so that next time
#  we run the tests, our runner will wait until the database has been
#  recreated.
#

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

mysql \
    -u$GRAPHER_TEST_DB_USER \
    -p$GRAPHER_TEST_DB_PASS \
    -h $GRAPHER_TEST_DB_HOST \
    --port=$GRAPHER_TEST_DB_PORT \
    -e 'drop table _test_db_ready' \
    $GRAPHER_TEST_DB_NAME
