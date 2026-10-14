#!/usr/bin/env bash
# Let worktree scripts use Windows-created Git worktrees when run from WSL.

WORKTREE_GIT_DIR=
if [ -f .git ] && command -v wslpath >/dev/null 2>&1; then
    gitdir="$(sed -n 's/^gitdir: //p' .git | tr -d '\r')"
    case "$gitdir" in
        [A-Za-z]:/*) WORKTREE_GIT_DIR="$(wslpath -u "$gitdir")" ;;
    esac
fi

worktree_git() {
    if [ -n "$WORKTREE_GIT_DIR" ]; then
        env GIT_DIR="$WORKTREE_GIT_DIR" GIT_WORK_TREE="$PWD" git "$@"
    else
        git "$@"
    fi
}

worktree_paths() {
    worktree_git worktree list --porcelain | sed -n 's/^worktree //p' | while IFS= read -r path; do
        case "$path" in
            [A-Za-z]:/*)
                if command -v wslpath >/dev/null 2>&1; then
                    wslpath -u "$path"
                else
                    printf '%s\n' "$path"
                fi
                ;;
            *) printf '%s\n' "$path" ;;
        esac
    done
}
