#!/usr/bin/env  bash
set -o errexit
set -o pipefail
set -o nounset

# This script is supposed to be run from a context in which node is available. Typically
# you run this via "make dbtest" and it will then spin up the docker container for the
# test database, initialize it and then run the tests

if [ -e .env ]; then
    source .env
fi

: "${GRAPHER_TEST_DB_USER:?Need to set GRAPHER_TEST_DB_USER non-empty}"
: "${GRAPHER_TEST_DB_PASS:?Need to set GRAPHER_TEST_DB_PASS non-empty}"
: "${GRAPHER_TEST_DB_NAME:?Need to set GRAPHER_TEST_DB_NAME non-empty}"

echo 'test database started'

docker compose -f docker-compose.dbtests.yml up -d >/dev/null 2>&1

./devTools/docker/wait-for-tests-mysql.sh

echo 'applying migrations'

yarn tsx --tsconfig tsconfig.tsx.json node_modules/typeorm/cli.js migration:run -d db/tests/dataSource.dbtests.ts >/dev/null 2>&1

echo 'running tests'
if ! yarn run vitest -c vitest.db.config.ts
then
    echo '💀 Tests failed'
    ./devTools/docker/mark-test-mysql-dirty.sh >/dev/null 2>&1
    docker compose -f docker-compose.dbtests.yml stop >/dev/null 2>&1
    exit 23
else
    echo '✅ DB tests succeeded'
    ./devTools/docker/mark-test-mysql-dirty.sh >/dev/null 2>&1
    docker compose -f docker-compose.dbtests.yml stop >/dev/null 2>&1
    exit 0
fi
