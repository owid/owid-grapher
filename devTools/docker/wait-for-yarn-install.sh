#!/usr/bin/env bash
# Wait for a `yarn install` that is already running in this checkout to finish.
#
# A worktree manager (Orca) runs `yarn install` as its setup script while the
# agent or terminal is already open, so `make up.worktree` often starts mid-install.
# Starting the servers then crashes them, and running a second install alongside
# the first one can leave node_modules broken, so wait for it instead. Detecting it
# by process rather than by a marker file works however the install was launched.
set -o errexit
set -o pipefail
set -o nounset

HERE="$(pwd -P)"

installs_running_here() {
    # `yarn install` and bare `yarn` both install; the corepack shim shows up as
    # yarn.js. Other yarn commands (`yarn startSiteFront`) must not match.
    for pid in $(pgrep -f -- '(^|/)yarn(\.c?js)? install( |$)|(^|/)yarn(\.c?js)?$' || true); do
        # /proc on Linux (agent images may not ship lsof), lsof on macOS; the
        # process may have exited since pgrep saw it, which must not end the script
        cwd="$(readlink "/proc/$pid/cwd" 2>/dev/null || lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p' || true)"
        [ "$cwd" = "$HERE" ] && return 0
    done
    return 1
}

installs_running_here || exit 0

printf '==> Waiting for the yarn install already running in this checkout'
for _ in $(seq 1 600); do
    if ! installs_running_here; then
        echo
        exit 0
    fi
    printf '.'
    sleep 1
done
echo
echo 'ERROR: yarn install is still running after 10 minutes'
exit 1
