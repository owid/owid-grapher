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

# Create log directory
mkdir -p tmp-logs

# Always try to stop the compose stack when exiting (success or failure)
cleanup() {
    docker compose -f docker-compose.dbtests.yml stop >/dev/null 2>&1 || true
}
trap cleanup EXIT

# Function to show last 100 lines of a log file on error
show_log_on_error() {
    local log_file="$1"
    local step_name="$2"
    if [ -f "$log_file" ]; then
        echo "❌ $step_name failed. Last 100 lines (full log: $log_file):"
        echo "----------------------------------------"
        tail -n 100 "$log_file"
        echo "----------------------------------------"
    else
        echo "❌ $step_name failed. No log file found at $log_file"
    fi
}

echo 'test database started'

if ! docker compose -f docker-compose.dbtests.yml up -d >tmp-logs/docker-startup.log 2>&1; then
    show_log_on_error "tmp-logs/docker-startup.log" "Docker startup"
    # In case the stack was partially created, ensure it's torn down
    docker compose -f docker-compose.dbtests.yml down >/dev/null 2>&1 || true
    exit 1
fi

if ! ./devTools/docker/wait-for-tests-mysql.sh >tmp-logs/mysql-wait.log 2>&1; then
    show_log_on_error "tmp-logs/mysql-wait.log" "MySQL wait"
    docker compose -f docker-compose.dbtests.yml stop >/dev/null 2>&1
    exit 1
fi

echo 'applying migrations'

if ! yarn tsx --tsconfig tsconfig.tsx.json node_modules/typeorm/cli.js migration:run -d db/tests/dataSource.dbtests.ts >tmp-logs/migrations.log 2>&1; then
    show_log_on_error "tmp-logs/migrations.log" "Database migrations"
    docker compose -f docker-compose.dbtests.yml stop >/dev/null 2>&1
    exit 1
fi

echo 'running tests'
if ! yarn run vitest run -c vitest.db.config.ts >tmp-logs/tests.log 2>&1
then
    show_log_on_error "tmp-logs/tests.log" "Tests"
    ./devTools/docker/mark-test-mysql-dirty.sh >/dev/null 2>&1
    docker compose -f docker-compose.dbtests.yml stop >/dev/null 2>&1
    exit 23
else
    echo '✅ DB tests succeeded'
    ./devTools/docker/mark-test-mysql-dirty.sh >/dev/null 2>&1
    docker compose -f docker-compose.dbtests.yml stop >/dev/null 2>&1
    exit 0
fi
