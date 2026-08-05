#!/usr/bin/env bash
# Make sure a MySQL holding the grapher db is reachable at
# GRAPHER_DB_HOST:GRAPHER_DB_PORT, starting one if it isn't. Prefers a MySQL
# that is already up (e.g. a native mysqld, as in the cloud sandbox snapshot,
# or the container another checkout started) and otherwise brings up the
# docker compose one, waiting for the dump import to finish.
#
# Shared by `make up.headless` and `make up.worktree`; safe to run on its own.
set -o errexit
set -o pipefail
set -o nounset

if [ -e .env ]; then
    set -a
    source .env
    set +a
fi
export COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-owid-grapher}"
GRAPHER_DB_HOST="${GRAPHER_DB_HOST:-127.0.0.1}"
GRAPHER_DB_PORT="${GRAPHER_DB_PORT:-3307}"

mkdir -p logs

mysql_reachable() {
    (exec 3<>"/dev/tcp/${GRAPHER_DB_HOST}/${GRAPHER_DB_PORT}") 2>/dev/null
}

start_docker_db() {
    if ! docker info >/dev/null 2>&1; then
        echo '==> Docker daemon not running, attempting to start it'
        service docker start >/dev/null 2>&1 || sudo service docker start >/dev/null 2>&1 || true
        if ! docker info >/dev/null 2>&1; then
            echo '==> service start failed, launching dockerd directly'
            nohup dockerd > logs/dockerd.log 2>&1 &
        fi
        for _ in $(seq 1 15); do
            docker info >/dev/null 2>&1 && break
            sleep 2
        done
        docker info >/dev/null 2>&1 || {
            echo 'ERROR: docker daemon is not running and could not be started (on macOS, start Docker Desktop; see logs/dockerd.log otherwise)'
            exit 1
        }
    fi

    [ -e tmp-downloads/owid_metadata.sql.gz ] || ./devTools/docker/download-grapher-metadata-mysql.sh

    echo '==> Starting MySQL via docker compose'
    docker compose -f docker-compose.grapher.yml up -d

    # the grapher db and user exist before the dump import finishes, so wait
    # for the db-load-data init container to exit instead of a bare `select 1`
    local dbinit="${COMPOSE_PROJECT_NAME}-db-load-data-1"
    echo "==> Waiting for the db init container ($dbinit) to finish (the first run imports the db dump and can take 5-15 minutes)"
    for i in $(seq 1 240); do
        [ "$(docker inspect -f '{{.State.Status}}' "$dbinit" 2>/dev/null)" = "exited" ] && break
        if [ "$i" -eq 240 ]; then
            echo
            echo 'ERROR: db init container did not finish, current containers:'
            docker ps -a
            exit 1
        fi
        printf '.'
        sleep 5
    done
    [ "$(docker inspect -f '{{.State.ExitCode}}' "$dbinit")" = "0" ] || {
        echo "ERROR: db load failed, check: docker logs $dbinit"
        exit 1
    }
    until docker compose -f docker-compose.grapher.yml exec -T db \
        mysql -u"${GRAPHER_DB_USER:-grapher}" -p"${GRAPHER_DB_PASS:-grapher}" -h 127.0.0.1 \
        -e 'select 1' "${GRAPHER_DB_NAME:-grapher}" >/dev/null 2>&1; do
        printf '.'
        sleep 2
    done
    echo ' ok'
}

if mysql_reachable; then
    echo '==> MySQL is already reachable, skipping docker'
elif service mysql start >/dev/null 2>&1 && sleep 3 && mysql_reachable; then
    echo '==> Started the local mysql service, skipping docker'
else
    start_docker_db
fi
