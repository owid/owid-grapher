#!/usr/bin/env bash
# Start a git worktree's dev environment next to the one running in your main
# checkout: its own admin server and vite on their own ports, in its own detached
# tmux session, sharing the MySQL that is already up. Called by
# `make up.worktree`; stop it again with `make down.worktree`.
#
# Detached rather than attached (`make up`) because worktrees are usually driven
# from a worktree manager like Orca or from an agent, where there is no terminal
# to hand to tmux. Attach any time with `tmux attach -t <session>`.
set -o errexit
set -o pipefail
set -o nounset

if [ "$(git rev-parse --git-dir)" = "$(git rev-parse --git-common-dir)" ]; then
    echo 'ERROR: this is the main checkout, not a git worktree.'
    echo 'Use `make up` here (tmux, attached), or `make up.headless` if there is no terminal to attach.'
    exit 1
fi

set -a
source .env
set +a
export COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-owid-grapher}"
export ADMIN_SERVER_PORT="${ADMIN_SERVER_PORT:-3031}"
export VITE_PORT="${VITE_PORT:-8091}"
# never wait on an interactive prompt when corepack fetches yarn
export COREPACK_ENABLE_DOWNLOAD_PROMPT="${COREPACK_ENABLE_DOWNLOAD_PROMPT:-0}"
SESSION="${TMUX_SESSION_NAME:-grapher-$(basename "$PWD")}"

mkdir -p logs

./devTools/docker/ensure-mysql.sh

# scoped to this worktree's session name, so the sessions of other checkouts and
# their servers are left alone
if tmux has-session -t "$SESSION" 2>/dev/null; then
    echo "==> Killing the existing '$SESSION' tmux session"
    tmux kill-session -t "$SESSION"
fi

# the ports are spelled out in the commands rather than exported: a new session
# on an already-running tmux server inherits that server's environment, not ours
echo "==> Starting the admin server and vite in the detached '$SESSION' tmux session"
tmux new-session -d -s "$SESSION" -c "$PWD" -n admin \
        "devTools/docker/wait-for-mysql.sh && ADMIN_SERVER_PORT=$ADMIN_SERVER_PORT VITE_PORT=$VITE_PORT yarn startAdminDevServer 2>&1 | tee logs/admin-server.log" \; \
        set remain-on-exit on \; \
    new-window -c "$PWD" -n vite \
        "VITE_PORT=$VITE_PORT yarn startSiteFront 2>&1 | tee logs/vite.log" \; \
        set remain-on-exit on \; \
    bind R respawn-pane -k \; \
    bind X kill-pane \; \
    set -g mouse on

echo '==> Waiting for the admin server to come up (can take a few minutes)'
for i in $(seq 1 180); do
    curl -sf -o /dev/null "http://localhost:${ADMIN_SERVER_PORT}/" && break
    if [ "$i" -eq 180 ]; then
        echo "ERROR: admin server did not come up, check logs/admin-server.log or \`tmux attach -t $SESSION\`"
        exit 1
    fi
    printf '.'
    sleep 2
done
echo
echo "Dev environment for this worktree is up (logs in logs/, attach with \`tmux attach -t $SESSION\`,"
echo 'stop with `make down.worktree`):'
echo
echo "    http://localhost:${ADMIN_SERVER_PORT}/  <-- a basic version of Our World in Data"
echo "    http://localhost:${ADMIN_SERVER_PORT}/grapher/life-expectancy  <-- an example chart"
echo "    http://localhost:${ADMIN_SERVER_PORT}/admin/  <-- an admin interface"
echo "    http://localhost:${VITE_PORT}/  <-- the vite dev server"
echo
echo 'Note that MySQL is shared with your other checkouts, so db changes here show up there too.'
