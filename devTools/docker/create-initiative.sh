#!/usr/bin/env bash
# Create a git worktree for a new BMad initiative and open it in VS Code:
#
#   <main checkout>/.worktrees/<name>  on a new branch <name> off master
#
# Needs Graphite (`gt`): master is brought up to date with `gt sync` (without
# restacking your other branches) and the new branch is tracked with master as
# its parent.
#
# The worktree gets its .env from `make setup.worktree`. BMad is not set up
# here: a user-level Claude Code SessionStart hook links _bmad and _bmad-output
# to the main checkout in every worktree, and user settings allow writes there.
#
# The initiative itself is created with `bmad` in the new window.
#
# Called by `make initiative INITIATIVE=<name>`.
set -o errexit
set -o pipefail
set -o nounset

INITIATIVE="${1:-}"

fail() {
    echo "ERROR: $1" >&2
    exit 1
}

# ask for the name when it wasn't passed, unless there's no one to ask
if [ -z "$INITIATIVE" ] && [ -t 0 ]; then
    read -r -p "Initiative name (kebab-case): " INITIATIVE
fi

# the name is also the folder name and the initiative's, so keep it to what
# all of them accept
[[ "$INITIATIVE" =~ ^[a-z0-9]+(-[a-z0-9]+)*$ ]] ||
    fail "'$INITIATIVE' isn't a kebab-case name, run: make initiative INITIATIVE=<name>"

# the first worktree listed is the main checkout, so running this from inside a
# worktree doesn't nest the new one in it
MAIN="$(git worktree list --porcelain | sed -n 's/^worktree //p' | head -n 1)"
WORKTREE="$MAIN/.worktrees/$INITIATIVE"

# git would create the branch before failing on an existing folder, and leave
# it behind
[ ! -e "$WORKTREE" ] || fail "$WORKTREE already exists"
command -v gt >/dev/null 2>&1 || fail "Graphite (gt) is required: https://graphite.dev/docs/install-the-cli"

echo "==> Updating master with gt sync"
(cd "$MAIN" && gt sync --no-restack --no-interactive) || fail "gt sync failed, nothing was created"
echo "==> Creating $WORKTREE on a new branch $INITIATIVE off master"
git -C "$MAIN" worktree add "$WORKTREE" -b "$INITIATIVE" master
(cd "$WORKTREE" && gt track "$INITIATIVE" --parent master --no-interactive) ||
    fail "gt track failed; $WORKTREE and branch $INITIATIVE were created, remove them with: git worktree remove $WORKTREE && git branch -D $INITIATIVE"

echo "==> Writing the worktree's .env"
make -C "$WORKTREE" setup.worktree

if command -v code >/dev/null 2>&1; then
    echo "==> Opening $WORKTREE in a new VS Code window"
    code -n "$WORKTREE"
else
    echo "==> The worktree is ready at $WORKTREE"
    echo "    To open it from here next time, install VS Code's \`code\` command:"
    echo "    in VS Code, run \"Shell Command: Install 'code' command in PATH\" from the Command Palette."
fi
echo "==> Then, in that window, paste this into Claude:"
echo
echo "    /bmad create initiative $INITIATIVE"
echo
