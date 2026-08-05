#!/usr/bin/env bash
# Write a .env that lets this checkout run its own dev environment next to the
# ones in your other checkouts: same MySQL, but its own admin/vite ports and its
# own tmux session name. Idempotent — does nothing if a .env already exists.
#
# Called by `make setup.worktree` and `make up.worktree`. Worktree managers like
# Orca can run it as their repo setup hook (`yarn install && make setup.worktree`)
# so a freshly created worktree is ready to `make up.worktree`.
set -o errexit
set -o pipefail
set -o nounset

if [ -e .env ]; then
    echo '==> .env already exists, leaving it untouched'
    exit 0
fi

# the main checkout keeps the documented ports and session name, so this script
# is safe to run anywhere; only worktrees need to move out of their way
if [ "$(git rev-parse --git-dir)" = "$(git rev-parse --git-common-dir)" ]; then
    cp .env.example-grapher .env
    echo '==> This is the main checkout, wrote .env with the default ports'
    exit 0
fi

TMUX_SESSION_NAME="grapher-$(basename "$PWD")"

# ports written into any of this repo's checkouts, whether or not something is
# listening on them right now — a worktree that is currently down still owns its
# ports, and we don't want to hand them to a second one. The main checkout's
# defaults are off-limits even though it doesn't have to spell them out.
claimed_ports() {
    echo 3030
    echo 8090
    git worktree list --porcelain | sed -n 's/^worktree //p' | while read -r worktree; do
        if [ -e "$worktree/.env" ]; then
            grep -hoE '^[A-Z_]+_PORT=[0-9]+' "$worktree/.env" | cut -d= -f2 || true
        fi
    done
}
CLAIMED="$(claimed_ports)"

port_taken() {
    # the dev servers listen on ::1, so probe localhost rather than 127.0.0.1
    (exec 3<>"/dev/tcp/localhost/$1") 2>/dev/null && return 0
    grep -qxF "$1" <<<"$CLAIMED"
}

# Random rather than "next one free": sequential ports get recycled, so deleting
# a worktree and creating another hands the new one the old one's port, and every
# stale bookmark and proxy rule then points at the wrong worktree. The two are
# drawn from a single offset, so the pair is easy to remember (3457 -> 8457).
for _ in $(seq 1 100); do
    offset=$((RANDOM % 1000))
    if ! port_taken $((3000 + offset)) && ! port_taken $((8000 + offset)); then
        ADMIN_SERVER_PORT=$((3000 + offset))
        VITE_PORT=$((8000 + offset))
        break
    fi
done
if [ -z "${ADMIN_SERVER_PORT:-}" ]; then
    echo 'ERROR: found no free port pair in 3000-3999 / 8000-8999 after 100 tries'
    exit 1
fi

# COMPOSE_PROJECT_NAME and the db ports are deliberately left at the defaults:
# every checkout talks to the same MySQL container, so a worktree doesn't have
# to import its own copy of the (multi-GB) dump
sed \
    -e "s/^TMUX_SESSION_NAME=.*/TMUX_SESSION_NAME=$TMUX_SESSION_NAME/" \
    -e "s/^ADMIN_SERVER_PORT=.*/ADMIN_SERVER_PORT=$ADMIN_SERVER_PORT/" \
    -e "s/^VITE_PORT=.*/VITE_PORT=$VITE_PORT/" \
    .env.example-grapher > .env

# older versions of the example file don't list all of these, and a value the
# sed above found nothing to replace would be silently lost
for setting in \
    "TMUX_SESSION_NAME=$TMUX_SESSION_NAME" \
    "ADMIN_SERVER_PORT=$ADMIN_SERVER_PORT" \
    "VITE_PORT=$VITE_PORT"; do
    grep -q "^${setting%%=*}=" .env || echo "$setting" >> .env
done

echo "==> Wrote .env for this checkout:"
echo "        TMUX_SESSION_NAME=$TMUX_SESSION_NAME"
echo "        ADMIN_SERVER_PORT=$ADMIN_SERVER_PORT"
echo "        VITE_PORT=$VITE_PORT"
