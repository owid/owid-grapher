#!/usr/bin/env bash
# List the tmux sessions running a dev environment of this repo, across the main
# checkout and all its git worktrees (`make up`, `make up.full`, `make up.worktree`,
# `make playwright`, …), with the branch and the admin/vite ports each one serves.
# A session counts when its start directory is a checkout of this repo, so this
# also finds sessions with a custom TMUX_SESSION_NAME. Called by `make sessions`.
set -o errexit
set -o pipefail
set -o nounset

if ! tmux list-sessions >/dev/null 2>&1; then
    echo 'No tmux sessions running.'
    exit 0
fi

commonDir="$(cd "$(git rev-parse --git-common-dir)" && pwd -P)"

# reads KEY from a checkout's .env without sourcing it
envValue() {
    local file="$1/.env" key="$2"
    [ -f "$file" ] || return 0
    sed -n "s/^${key}=\([^#]*\).*/\1/p" "$file" | tail -n 1 | tr -d ' "'"'"
}

rows=()
while IFS=$'\t' read -r name path attached; do
    sessionCommonDir="$(cd "$path" 2>/dev/null && cd "$(git rev-parse --git-common-dir 2>/dev/null)" 2>/dev/null && pwd -P)" || continue
    [ "$sessionCommonDir" = "$commonDir" ] || continue

    branch="$(git -C "$path" branch --show-current 2>/dev/null)"
    admin="$(envValue "$path" ADMIN_SERVER_PORT)"
    vite="$(envValue "$path" VITE_PORT)"
    state="detached"
    [ "$attached" -gt 0 ] && state="attached"
    rows+=("$name"$'\t'"${branch:--}"$'\t'"http://localhost:${admin:-3030}/admin"$'\t'"http://localhost:${vite:-8090}"$'\t'"$state"$'\t'"${path/#$HOME/~}")
done < <(tmux list-sessions -F $'#{session_name}\t#{session_path}\t#{session_attached}')

if [ "${#rows[@]}" -eq 0 ]; then
    echo 'No grapher tmux sessions running.'
    exit 0
fi

{
    printf 'SESSION\tBRANCH\tADMIN\tSITE\tSTATE\tPATH\n'
    printf '%s\n' "${rows[@]}"
} | column -t -s $'\t'
echo
echo 'Attach:  tmux attach -t =<session>'
echo 'Kill:    tmux kill-session -t =<session>   (leaves the shared MySQL up)'
