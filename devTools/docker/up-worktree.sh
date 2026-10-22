#!/usr/bin/env bash
# Start a git worktree's dev environment next to the one running in your main
# checkout: its own admin server, vite and Cloudflare functions server on their
# own ports, in its own detached tmux session, sharing the MySQL that is already
# up. Called by `make up.worktree`; stop it again with `make down.worktree`.
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
export WRANGLER_PORT="${WRANGLER_PORT:?is missing from .env, run make setup.worktree}"
# never wait on an interactive prompt when corepack fetches yarn
export COREPACK_ENABLE_DOWNLOAD_PROMPT="${COREPACK_ENABLE_DOWNLOAD_PROMPT:-0}"
SESSION="${TMUX_SESSION_NAME:-grapher-$(basename "$PWD")}"

mkdir -p logs

./devTools/docker/ensure-mysql.sh

# scoped to this worktree's session name, so the sessions of other checkouts and
# their servers are left alone
if tmux has-session -t "=$SESSION" 2>/dev/null; then
    echo "==> Killing the existing '$SESSION' tmux session"
    tmux kill-session -t "=$SESSION"
fi

# A new session on an already-running tmux server gets that server's
# environment, not ours, and dotenv never overrides a variable that is already
# set — so a port another checkout left in the tmux server would silently win
# over this worktree's .env (vite would then fetch chart configs from that
# checkout's admin server). Hand the session everything in .env, plus the
# defaults above, explicitly.
session_env=()
while read -r name; do
    session_env+=(-e "$name=${!name}")
done < <({
    sed -n 's/^\([A-Za-z_][A-Za-z0-9_]*\)=.*/\1/p' .env
    printf '%s\n' COMPOSE_PROJECT_NAME ADMIN_SERVER_PORT VITE_PORT WRANGLER_PORT COREPACK_ENABLE_DOWNLOAD_PROMPT
} | sort -u)

# the functions window is marked @optional: it exits during startup without
# Cloudflare credentials, and the site works without it
echo "==> Starting the admin server, vite and the functions server in the detached '$SESSION' tmux session"
tmux new-session -d -s "$SESSION" "${session_env[@]}" -c "$PWD" -n admin \
        "devTools/docker/wait-for-mysql.sh && yarn startAdminDevServer 2>&1 | tee logs/admin-server.log" \; \
        set remain-on-exit on \; \
    new-window -c "$PWD" -n vite \
        "yarn startSiteFront 2>&1 | tee logs/vite.log" \; \
        set remain-on-exit on \; \
    new-window -c "$PWD" -n functions \
        "yarn startLocalCloudflareFunctions 2>&1 | tee logs/functions.log" \; \
        set remain-on-exit on \; \
        set -w @optional 1 \; \
    bind R respawn-pane -k \; \
    bind X kill-pane \; \
    set -g mouse on

echo '==> Waiting for the admin server to come up (can take a few minutes)'
for i in $(seq 1 180); do
    curl -sf -o /dev/null "http://localhost:${ADMIN_SERVER_PORT}/" && break
    # a server that crashed on startup never comes up, so stop waiting as soon as
    # one of the panes has died (remain-on-exit keeps it around to read); a pane that
    # died before remain-on-exit was set takes the whole session with it. Windows
    # marked @optional are allowed to die.
    if ! panes="$(tmux list-panes -s -t "=$SESSION" -F '#{pane_dead} #{?@optional,optional,required} #{window_name}' 2>/dev/null)"; then
        echo
        echo "ERROR: the '$SESSION' tmux session is gone, check logs/admin-server.log"
        exit 1
    fi
    dead_window="$(awk '$1 == 1 && $2 == "required" { print $3; exit }' <<<"$panes")"
    if [ -n "$dead_window" ]; then
        echo
        echo "ERROR: the $dead_window server exited during startup:"
        tmux capture-pane -p -t "=$SESSION:$dead_window" | sed '/^$/d' | tail -n 20
        exit 1
    fi
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
echo "    http://localhost:${WRANGLER_PORT}/grapher/life-expectancy.png  <-- the Cloudflare functions (thumbnails, /api, …)"
echo
echo "The functions server needs Cloudflare credentials (see functions/README.md); without"
echo "them it exits (logs/functions.log says why), and everything else still works."
echo
echo 'Note that MySQL is shared with your other checkouts, so db changes here show up there too.'
