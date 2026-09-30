#!/usr/bin/env bash
# Write a .env that lets this checkout run its own dev environment next to the
# ones in your other checkouts: same MySQL, but its own admin/vite/functions ports
# and its own tmux session name. Idempotent — an existing .env is left alone,
# except that a worktree's .env written before the functions server had a port
# gets one added.
#
# Called by `make setup.worktree` and `make up.worktree`. Worktree managers like
# Orca can run it as their repo setup hook (`yarn install && make setup.worktree`)
# so a freshly created worktree is ready to `make up.worktree`.
set -o errexit
set -o pipefail
set -o nounset

is_main_checkout() {
    [ "$(git rev-parse --git-dir)" = "$(git rev-parse --git-common-dir)" ]
}

# ports written into any of this repo's checkouts, whether or not something is
# listening on them right now — a worktree that is currently down still owns its
# ports, and we don't want to hand them to a second one. The main checkout's
# defaults are off-limits even though it doesn't have to spell them out.
claimed_ports() {
    echo 3030
    echo 8090
    echo 8788
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

if [ -e .env ]; then
    # worktrees set up before `make up.worktree` started the functions server
    # have no port for it; add one rather than make them recreate their .env
    if ! is_main_checkout && ! grep -q '^WRANGLER_PORT=' .env; then
        admin_port="$(sed -n 's/^ADMIN_SERVER_PORT=\([0-9]*\).*/\1/p' .env | tail -n 1)"
        # the same offset as the other two when it's free, so the three still
        # read as a set (3457 -> 8457 -> 9457); any free one otherwise
        candidate=$((admin_port + 6000))
        if [ -z "$admin_port" ] || [ "$candidate" -lt 9000 ] || [ "$candidate" -gt 9999 ] || port_taken "$candidate"; then
            candidate=""
            for _ in $(seq 1 100); do
                port=$((9000 + RANDOM % 1000))
                if ! port_taken "$port"; then
                    candidate="$port"
                    break
                fi
            done
        fi
        if [ -z "$candidate" ]; then
            echo 'ERROR: found no free port in 9000-9999 for the functions server after 100 tries'
            exit 1
        fi
        echo "WRANGLER_PORT=$candidate" >> .env
        echo "==> .env already exists, added the functions server's port: WRANGLER_PORT=$candidate"
        exit 0
    fi
    echo '==> .env already exists, leaving it untouched'
    exit 0
fi

# the main checkout keeps the documented ports and session name, so this script
# is safe to run anywhere; only worktrees need to move out of their way
if is_main_checkout; then
    cp .env.example-grapher .env
    echo '==> This is the main checkout, wrote .env with the default ports'
    exit 0
fi

TMUX_SESSION_NAME="grapher-$(basename "$PWD")"

# Random rather than "next one free": sequential ports get recycled, so deleting
# a worktree and creating another hands the new one the old one's port, and every
# stale bookmark and proxy rule then points at the wrong worktree. The three are
# drawn from a single offset, so the set is easy to remember (3457 -> 8457 -> 9457).
for _ in $(seq 1 100); do
    offset=$((RANDOM % 1000))
    if ! port_taken $((3000 + offset)) && ! port_taken $((8000 + offset)) && ! port_taken $((9000 + offset)); then
        ADMIN_SERVER_PORT=$((3000 + offset))
        VITE_PORT=$((8000 + offset))
        WRANGLER_PORT=$((9000 + offset))
        break
    fi
done
if [ -z "${ADMIN_SERVER_PORT:-}" ]; then
    echo 'ERROR: found no free port set in 3000-3999 / 8000-8999 / 9000-9999 after 100 tries'
    exit 1
fi

# COMPOSE_PROJECT_NAME and the db ports are deliberately left at the defaults:
# every checkout talks to the same MySQL container, so a worktree doesn't have
# to import its own copy of the (multi-GB) dump
sed \
    -e "s/^TMUX_SESSION_NAME=.*/TMUX_SESSION_NAME=$TMUX_SESSION_NAME/" \
    -e "s/^ADMIN_SERVER_PORT=.*/ADMIN_SERVER_PORT=$ADMIN_SERVER_PORT/" \
    -e "s/^VITE_PORT=.*/VITE_PORT=$VITE_PORT/" \
    -e "s/^WRANGLER_PORT=.*/WRANGLER_PORT=$WRANGLER_PORT/" \
    .env.example-grapher > .env

# older versions of the example file don't list all of these, and a value the
# sed above found nothing to replace would be silently lost
for setting in \
    "TMUX_SESSION_NAME=$TMUX_SESSION_NAME" \
    "ADMIN_SERVER_PORT=$ADMIN_SERVER_PORT" \
    "VITE_PORT=$VITE_PORT" \
    "WRANGLER_PORT=$WRANGLER_PORT"; do
    grep -q "^${setting%%=*}=" .env || echo "$setting" >> .env
done

# copy credentials from the main checkout's .env if present: search-only
# Algolia keys, and a Cloudflare API token that wrangler reads from .env and
# prefers over its machine-wide `wrangler login` (which may be another account)
MAIN_WORKTREE="$(git worktree list --porcelain | sed -n 's/^worktree //p' | head -n 1)"
if [ -n "$MAIN_WORKTREE" ] && [ -e "$MAIN_WORKTREE/.env" ]; then
    for var in ALGOLIA_ID ALGOLIA_SEARCH_KEY CLOUDFLARE_API_TOKEN CLOUDFLARE_ACCOUNT_ID; do
        line="$(grep -E "^[[:space:]]*${var}=" "$MAIN_WORKTREE/.env" | tail -n 1 || true)"
        [ -n "$line" ] && echo "$line" >> .env
    done
fi

echo "==> Wrote .env for this checkout:"
echo "        TMUX_SESSION_NAME=$TMUX_SESSION_NAME"
echo "        ADMIN_SERVER_PORT=$ADMIN_SERVER_PORT"
echo "        VITE_PORT=$VITE_PORT"
echo "        WRANGLER_PORT=$WRANGLER_PORT"
