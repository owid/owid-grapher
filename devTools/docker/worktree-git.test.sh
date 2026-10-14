#!/usr/bin/env bash
# Run from a checkout root, including a Windows-created worktree opened in WSL.
set -euo pipefail

source devTools/docker/worktree-git.sh

if [ "$(worktree_git rev-parse --show-toplevel)" != "$PWD" ]; then
    echo 'ERROR: Git did not recognise this checkout'
    exit 1
fi

paths="$(worktree_paths)"
if ! grep -qxF "$PWD" <<<"$paths"; then
    echo 'ERROR: the current worktree path was not usable by this shell'
    exit 1
fi
if grep -Eq '^[A-Za-z]:[/\\]' <<<"$paths"; then
    echo 'ERROR: worktree paths still contain Windows drive letters'
    exit 1
fi

echo 'Worktree Git paths are usable in this shell'
