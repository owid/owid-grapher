#!/usr/bin/env bash
# Headless variant of `make up` for environments without a terminal to attach
# tmux to (AI agents, cloud sandboxes, CI). Called by `make up.headless`.
#
# Uses a MySQL that is already reachable at GRAPHER_DB_HOST:GRAPHER_DB_PORT
# (e.g. a native mysqld, as in the cloud sandbox snapshot) and otherwise
# starts one via docker compose. Runs the admin server and vite as background
# processes logging into logs/.
set -o errexit
set -o pipefail
set -o nounset

if [ -e .env ]; then
    set -a
    source .env
    set +a
fi
export COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-owid-grapher}"
export ADMIN_SERVER_PORT="${ADMIN_SERVER_PORT:-3030}"
export VITE_PORT="${VITE_PORT:-8090}"
# never wait on an interactive prompt when corepack fetches yarn
export COREPACK_ENABLE_DOWNLOAD_PROMPT="${COREPACK_ENABLE_DOWNLOAD_PROMPT:-0}"
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

echo '==> (Re)starting the admin server and vite in the background'
pkill -f 'adminSiteServer/app.ts' 2>/dev/null || true
pkill -f 'vite dev --config vite.config-site.mts' 2>/dev/null || true
nohup yarn startAdminDevServer > logs/admin-server.log 2>&1 &
echo $! > logs/admin-server.pid
nohup yarn startSiteFront > logs/vite.log 2>&1 &
echo $! > logs/vite.pid

echo '==> Waiting for the admin server to come up (can take a few minutes)'
for i in $(seq 1 180); do
    curl -sf -o /dev/null "http://localhost:${ADMIN_SERVER_PORT}/" && break
    if [ "$i" -eq 180 ]; then
        echo 'ERROR: admin server did not come up, check logs/admin-server.log'
        exit 1
    fi
    printf '.'
    sleep 2
done
echo
echo 'Dev environment is up (logs in logs/, stop with `make down.headless`):'
echo
echo "    http://localhost:${ADMIN_SERVER_PORT}/  <-- a basic version of Our World in Data"
echo "    http://localhost:${ADMIN_SERVER_PORT}/grapher/life-expectancy  <-- an example chart"
echo "    http://localhost:${ADMIN_SERVER_PORT}/admin/  <-- an admin interface"
echo "    http://localhost:${VITE_PORT}/  <-- the vite dev server"
