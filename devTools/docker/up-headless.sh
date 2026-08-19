#!/usr/bin/env bash
# Headless variant of `make up` for environments without a terminal to attach
# tmux to (AI agents, cloud sandboxes, CI). Called by `make up.headless`.
#
# Gets a MySQL up via ensure-mysql.sh and runs the admin server and vite as
# background processes logging into logs/.
#
# This kills any admin server and vite already running on this machine, whatever
# checkout they belong to. To run a git worktree's dev environment next to an
# existing one instead, use `make up.worktree`.
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

mkdir -p logs

./devTools/docker/ensure-mysql.sh

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
