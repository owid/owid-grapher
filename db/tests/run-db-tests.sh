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

echo '==> Starting & initializing Mysql instance for testing'

docker compose -f docker-compose.dbtests.yml up -d

./devTools/docker/wait-for-tests-mysql.sh

echo '==> Running migrations'

yarn tsx --tsconfig tsconfig.tsx.json node_modules/typeorm/cli.js migration:run -d db/tests/dataSource.dbtests.ts

echo '==> Running tests'
if ! yarn run jest --config=jest.db.config.js --runInBand # runInBand runs multiple test files serially - useful to avoid weird race conditions
then
    echo '💀 Tests failed'
    ./devTools/docker/mark-test-mysql-dirty.sh
    docker compose -f docker-compose.dbtests.yml stop
    exit 23
else
    echo '✅ DB tests succeeded'
    ./devTools/docker/mark-test-mysql-dirty.sh
    docker compose -f docker-compose.dbtests.yml stop
    exit 0
fi
