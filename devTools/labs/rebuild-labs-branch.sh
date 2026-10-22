#!/usr/bin/env bash
#
# Rebuild the `labs` branch from scratch: origin/master plus every open PR
# labelled `labs`, merged in PR-number order, then force-push it. Pushing the
# branch is what deploys Labs: its draft PR gets a staging server like any other.
#
# When a PR conflicts with master or with the PRs merged before it, Claude Code
# resolves the conflicts (if the `claude` CLI is available), guided by
# resolve-conflict.prompt.md. A resolution is kept only if no conflict markers
# are left and the result typechecks; git rerere records it, so the same
# conflict is replayed on later rebuilds instead of being resolved again.
# Anything else leaves the PR out of this build, listed in the Labs PR
# description.
#
# Usage: devTools/labs/rebuild-labs-branch.sh [--dry-run]
#   --dry-run  build the branch locally and print the result, but don't push
#
# Environment:
#   LABS_AGENT_MODEL  model for resolving conflicts (default: claude-opus-5-5)

set -o errexit
set -o pipefail
set -o nounset

# mapfile needs bash 4 or newer (macOS ships 3.2 as /bin/bash)
if (( BASH_VERSINFO[0] < 4 )); then
    echo "This script needs bash 4 or newer" >&2
    exit 1
fi

REPO="owid/owid-grapher"
LABEL="labs"
LABS_BRANCH="labs"
LABS_PR_TITLE="Labs (DO NOT MERGE)"
AGENT_MODEL="${LABS_AGENT_MODEL:-claude-opus-5-5}"

DRY_RUN=""
if [[ "${1:-}" == "--dry-run" ]]; then
    DRY_RUN=1
fi

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
REPO_ROOT=$(git rev-parse --show-toplevel)
WORKTREE=$(mktemp -d "${TMPDIR:-/tmp}/labs-rebuild.XXXXXX")
LOG_DIR=$(mktemp -d "${TMPDIR:-/tmp}/labs-rebuild-logs.XXXXXX")

cleanup() {
    git -C "$REPO_ROOT" worktree remove --force "$WORKTREE" 2>/dev/null || true
}
trap cleanup EXIT

# rerere via -c, so the rebuild never changes the repo's own git config. No
# autoUpdate: replayed files stay unstaged until the result has typechecked.
GIT_RERERE=(git -c rerere.enabled=true -c rerere.autoUpdate=false)

has_agent() {
    command -v claude >/dev/null
}

# Undo a failed merge completely, including anything the agent edited outside
# the conflicted files, so the next merge starts from a clean tree
abort_merge() {
    git merge --abort
    git reset --quiet --hard
    git clean --quiet -fd
}

# Files among the given ones that still contain conflict markers
files_with_markers() {
    local file
    for file in "$@"; do
        if [[ -f "$file" ]] && grep -qE '^(<<<<<<<|>>>>>>>) ' "$file"; then
            echo "$file"
        fi
    done
}

as_code_list() {
    sed 's/^/`/; s/$/`/' | paste -sd ',' - | sed 's/,/, /g'
}

resolve_with_agent() {
    local number=$1 title=$2 body=$3 included=$4
    shift 4
    local prompt
    prompt="$(cat "$SCRIPT_DIR/resolve-conflict.prompt.md")

## The incoming PR: #$number $title

${body:0:4000}

## Already on Labs in this build

${included:-Only master.}

## Conflicted files

$(printf -- '- %s\n' "$@")"

    # Reading and editing files, and read-only git; anything else is denied
    claude -p "$prompt" \
        --model "$AGENT_MODEL" \
        --permission-mode dontAsk \
        --allowedTools "Read" "Edit" "Grep" "Glob" \
        "Bash(git diff:*)" "Bash(git log:*)" "Bash(git show:*)" "Bash(git status:*)" \
        --no-session-persistence
}

typechecks() {
    # skip-build: typechecking needs no install scripts. immutable: never leave a
    # changed yarn.lock behind in the worktree, where it would block the next merge.
    yarn install --immutable --mode=skip-build && echo "--- yarn typecheck" && yarn typecheck
}

echo "--- Fetching origin/master"
git -C "$REPO_ROOT" fetch --quiet origin master

# Same-repo PRs only: a fork's branch isn't ours to deploy to a staging server
echo "--- Finding open PRs labelled '$LABEL'"
PRS=$(gh pr list --repo "$REPO" --label "$LABEL" --state open --limit 100 \
    --json number,headRefName,headRefOid,title,isCrossRepository \
    --jq "sort_by(.number) | .[] | select(.isCrossRepository | not) | select(.headRefName != \"$LABS_BRANCH\") | [.number, .headRefName, .headRefOid, .title] | @tsv")

git -C "$REPO_ROOT" worktree add --quiet --detach "$WORKTREE" origin/master
cd "$WORKTREE"
MASTER_SHA=$(git rev-parse --short origin/master)
INCLUDED=""
LEFT_OUT=""

while IFS=$'\t' read -r number head sha title; do
    [[ -z "$number" ]] && continue
    echo "--- Merging #$number ($head)"
    git fetch --quiet origin "$sha"
    entry="- #$number $title (\`${sha:0:7}\`)"
    if "${GIT_RERERE[@]}" merge --no-ff --no-edit --quiet -m "Labs: merge #$number $title" "$sha"; then
        INCLUDED+="$entry"$'\n'
        continue
    fi

    mapfile -t conflicted < <(git diff --name-only --diff-filter=U)
    conflict_list=$(printf '%s\n' "${conflicted[@]}" | as_code_list)
    mapfile -t unresolved < <(files_with_markers "${conflicted[@]}")
    note="conflicts in $conflict_list resolved as on an earlier rebuild"
    agent_note=""

    if [[ ${#unresolved[@]} -gt 0 ]] && has_agent; then
        echo "    Asking $AGENT_MODEL to resolve conflicts in ${unresolved[*]}"
        pr_body=$(gh pr view "$number" --repo "$REPO" --json body --jq .body)
        if summary=$(resolve_with_agent "$number" "$title" "$pr_body" "$INCLUDED" "${unresolved[@]}" \
            2>"$LOG_DIR/agent-$number.log"); then
            summary=$(echo "$summary" | tr '\n' ' ' | sed 's/  */ /g; s/ *$//')
            note="conflicts in $conflict_list resolved by an agent: $summary"
            agent_note=" (agent: $summary)"
        else
            echo "    The agent failed; its log: $LOG_DIR/agent-$number.log"
        fi
        mapfile -t unresolved < <(files_with_markers "${conflicted[@]}")
    fi

    if [[ ${#unresolved[@]} -gt 0 ]]; then
        abort_merge
        echo "    Left out: unresolved conflicts in ${unresolved[*]}"
        LEFT_OUT+="- #$number $title: conflicts in $(printf '%s\n' "${unresolved[@]}" | as_code_list)$agent_note"$'\n'
        continue
    fi

    echo "    Typechecking the resolution"
    if ! typechecks >"$LOG_DIR/typecheck-$number.log" 2>&1; then
        # Forget the resolution, so the next rebuild resolves this conflict afresh
        "${GIT_RERERE[@]}" rerere forget -- "${conflicted[@]}" >/dev/null 2>&1 || true
        abort_merge
        echo "    Left out: the resolution doesn't typecheck; log: $LOG_DIR/typecheck-$number.log"
        tail -n 20 "$LOG_DIR/typecheck-$number.log"
        LEFT_OUT+="- #$number $title: conflicts in $conflict_list, and the attempted resolution doesn't typecheck"$'\n'
        continue
    fi

    # Everything the merge changed, including files the agent fixed outside the conflict
    git add --all
    # Committing with rerere enabled records the resolution for later rebuilds
    "${GIT_RERERE[@]}" commit --quiet --no-edit
    INCLUDED+="$entry: $note"$'\n'
done <<< "$PRS"

BODY=$(cat <<EOF
Labs is a staff-only copy of the site: master plus every open PR labelled \`$LABEL\`. This branch is rebuilt from scratch by \`devTools/labs/rebuild-labs-branch.sh\`, so don't push to it or merge it. To put a feature on Labs, add the \`$LABEL\` label to its PR; to take it off, remove the label.

**Built from** master at \`$MASTER_SHA\`, plus:

${INCLUDED:-_No labelled PRs._}
EOF
)
if [[ -n "$LEFT_OUT" ]]; then
    BODY+=$'\n'"**Left out of this build** (they don't merge cleanly with master and the PRs above):"$'\n\n'"$LEFT_OUT"
fi

echo "--- Result"
echo "$BODY"

if [[ -n "$DRY_RUN" ]]; then
    echo "--- Dry run: not pushing"
    exit 0
fi

echo "--- Pushing $LABS_BRANCH"
git push --quiet --force origin "HEAD:refs/heads/$LABS_BRANCH"

LABS_PR=$(gh pr list --repo "$REPO" --head "$LABS_BRANCH" --state open --json number --jq '.[0].number // empty')
if [[ -z "$LABS_PR" ]]; then
    echo "--- Opening the Labs draft PR"
    # staging-algolia: a search index of its own, or /search 404s on staging servers.
    # pinned: keeps the stale bot from closing the PR, and with it the Labs server.
    gh pr create --repo "$REPO" --draft --base master --head "$LABS_BRANCH" \
        --title "$LABS_PR_TITLE" --label staging-algolia --label pinned --body "$BODY"
else
    echo "--- Updating the description of #$LABS_PR"
    gh pr edit "$LABS_PR" --repo "$REPO" --body "$BODY"
fi
