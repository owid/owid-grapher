#!/usr/bin/env bash
#
# Rebuild the `labs` branch from scratch: origin/master plus every open PR
# labelled `labs`, merged in PR-number order, then force-push it. Pushing the
# branch is what deploys Labs: its draft PR gets a staging server like any other.
#
# Only PRs from branches of this repo, by authors who can push to it, are taken:
# everything that reaches the conflict-resolving agent below is then written by
# someone who can already run code with this repo's secrets.
#
# When a PR conflicts with master or with the PRs merged before it, Claude Code
# resolves the conflicted files (if the `claude` CLI is available), guided by
# resolve-conflict.prompt.md. A resolution is kept only if no conflict markers
# are left, nothing outside the conflicted files changed, and the result
# typechecks; git rerere records it, so the same conflict is replayed on later
# rebuilds instead of being resolved again. Conflicts that need a person (a
# deleted or binary file, yarn.lock) and anything else that fails leave the PR
# out of this build, listed in the Labs PR description.
#
# Usage: devTools/labs/rebuild-labs-branch.sh [--dry-run]
#   --dry-run  build the branch locally and print the result, but don't push
#
# Environment:
#   LABS_AGENT_MODEL    model for resolving conflicts (default: claude-opus-5-5)
#   LABS_AGENT_TIMEOUT  seconds one conflict may take the agent (default: 900)

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
AGENT_TIMEOUT="${LABS_AGENT_TIMEOUT:-900}"

DRY_RUN=""
if [[ "${1:-}" == "--dry-run" ]]; then
    DRY_RUN=1
fi

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
REPO_ROOT=$(git rev-parse --show-toplevel)
WORKTREE=$(mktemp -d "${TMPDIR:-/tmp}/labs-rebuild.XXXXXX")
TYPECHECK_LOG=$(mktemp "${TMPDIR:-/tmp}/labs-typecheck.XXXXXX")
AGENT_OUTPUT=$(mktemp "${TMPDIR:-/tmp}/labs-agent.XXXXXX")

cleanup() {
    git -C "$REPO_ROOT" worktree remove --force "$WORKTREE" 2>/dev/null || true
    rm -f "$TYPECHECK_LOG" "$AGENT_OUTPUT"
}
trap cleanup EXIT

# rerere via -c, so the rebuild never changes the repo's own git config. No
# autoUpdate: replayed files stay unstaged until the result has typechecked.
GIT_RERERE=(git -c rerere.enabled=true -c rerere.autoUpdate=false)

has_agent() {
    command -v claude >/dev/null
}

author_can_push() {
    local permission
    permission=$(gh api "repos/$REPO/collaborators/$1/permission" --jq .permission 2>/dev/null </dev/null) || return 1
    [[ "$permission" == "admin" || "$permission" == "maintain" || "$permission" == "write" ]]
}

as_code_list() {
    sed 's/^/`/; s/$/`/' | paste -sd ',' - | sed 's/,/, /g'
}

# Conflicts the agent can't resolve by editing text: one side deleted the file
# (only two of the three index stages exist), a binary file, or yarn.lock,
# which only yarn can merge
conflicts_needing_a_person() {
    local file stages
    for file in "$@"; do
        stages=$(git ls-files -u -- "$file" | awk '{print $3}' | sort -u | tr -d '\n')
        if [[ "$file" == "yarn.lock" || ( "$stages" != "123" && "$stages" != "23" ) ]] \
            || { [[ -s "$file" ]] && ! grep -qI . "$file"; }; then
            echo "$file"
        fi
    done
}

# Files among the given ones that still contain conflict markers
files_with_markers() {
    local file
    for file in "$@"; do
        if grep -qE '^(<<<<<<<|>>>>>>>) ' "$file"; then
            echo "$file"
        fi
    done
}

# Files the merge changed outside the given conflicted ones. The agent may only
# edit those: rerere replays nothing else on later rebuilds.
changes_outside() {
    { git diff --name-only; git ls-files --others --exclude-standard; } | sort -u \
        | grep -vxF -f <(printf '%s\n' "$@") || true
}

# Undo a failed merge completely, including anything edited outside the
# conflicted files, so the next merge starts from a clean tree
abort_merge() {
    git merge --abort
    git reset --quiet --hard
    git clean --quiet -fd
}

# The agent's sentence goes into a public PR description: keep it short, and
# stop @mentions in it from pinging anyone
sanitize_summary() {
    tr '\n' ' ' | sed 's/  */ /g; s/^ *//; s/ *$//; s/@/@\&#8203;/g' | cut -c1-500
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

    # Reading and editing files, and read-only git. The agent's log goes to
    # stderr, so it lands in the job log. stdin is closed, or `claude` would
    # read the rest of the PR list. perl's alarm is a timeout macOS also has, and
    # the answer goes to a file: a pipe would wait for any subprocess the agent
    # left running after the timeout.
    perl -e 'alarm shift; exec @ARGV' "$AGENT_TIMEOUT" \
        claude -p "$prompt" \
        --model "$AGENT_MODEL" \
        --permission-mode dontAsk \
        --allowedTools "Read" "Edit" "Grep" "Glob" \
        "Bash(git diff:*)" "Bash(git log:*)" "Bash(git show:*)" "Bash(git status:*)" \
        --no-session-persistence </dev/null >"$AGENT_OUTPUT"
}

typechecks() {
    # skip-build: typechecking needs no install scripts. immutable: never leave a
    # changed yarn.lock behind in the worktree, where it would block the next merge.
    { yarn install --immutable --mode=skip-build && echo "--- yarn typecheck" && yarn typecheck; } \
        >"$TYPECHECK_LOG" 2>&1 </dev/null
}

echo "--- Fetching origin/master"
git -C "$REPO_ROOT" fetch --quiet origin master

# Same-repo PRs only: a fork's branch isn't ours to deploy to a staging server
echo "--- Finding open PRs labelled '$LABEL'"
PRS=$(gh pr list --repo "$REPO" --label "$LABEL" --state open --limit 100 \
    --json number,headRefName,headRefOid,title,isCrossRepository,author \
    --jq "sort_by(.number) | .[] | select(.isCrossRepository | not) | select(.headRefName != \"$LABS_BRANCH\") | [.number, .headRefName, .headRefOid, .author.login, .title] | @tsv")

git -C "$REPO_ROOT" worktree add --quiet --detach "$WORKTREE" origin/master
cd "$WORKTREE"
MASTER_SHA=$(git rev-parse --short origin/master)
INCLUDED=""
LEFT_OUT=""

# The PR list is read from fd 3, so nothing inside the loop can consume it
while IFS=$'\t' read -r number head sha author title <&3; do
    [[ -z "$number" ]] && continue
    echo "--- Merging #$number ($head)"
    entry="- #$number $title (\`${sha:0:7}\`)"

    if ! author_can_push "$author"; then
        echo "    Left out: $author can't push to $REPO"
        LEFT_OUT+="- #$number $title: its author can't push to this repo, so Labs doesn't build it"$'\n'
        continue
    fi
    if ! git fetch --quiet origin "$sha"; then
        echo "    Left out: couldn't fetch $sha"
        LEFT_OUT+="- #$number $title: its latest commit couldn't be fetched; it's back on the next rebuild"$'\n'
        continue
    fi
    if "${GIT_RERERE[@]}" merge --no-ff --no-edit --quiet -m "Labs: merge #$number $title" "$sha"; then
        INCLUDED+="$entry"$'\n'
        continue
    fi

    mapfile -t conflicted < <(git diff --name-only --diff-filter=U)
    conflict_list=$(printf '%s\n' "${conflicted[@]}" | as_code_list)

    mapfile -t for_a_person < <(conflicts_needing_a_person "${conflicted[@]}")
    if [[ ${#for_a_person[@]} -gt 0 ]]; then
        abort_merge
        echo "    Left out: conflicts that need a person in ${for_a_person[*]}"
        LEFT_OUT+="- #$number $title: conflicts in $(printf '%s\n' "${for_a_person[@]}" | as_code_list) need a person (a deleted or binary file, or \`yarn.lock\`)"$'\n'
        continue
    fi

    # Files rerere couldn't resolve from an earlier rebuild
    mapfile -t remaining < <("${GIT_RERERE[@]}" rerere remaining)
    note="conflicts in $conflict_list resolved as on an earlier rebuild"
    summary=""
    reason=""
    attempts=0
    while :; do
        attempts=$((attempts + 1))
        if [[ ${#remaining[@]} -gt 0 ]]; then
            if ! has_agent; then
                reason="conflicts in $(printf '%s\n' "${remaining[@]}" | as_code_list)"
                break
            fi
            echo "    Asking $AGENT_MODEL to resolve conflicts in ${remaining[*]}"
            pr_body=$(gh pr view "$number" --repo "$REPO" --json body --jq .body </dev/null)
            if ! resolve_with_agent "$number" "$title" "$pr_body" "$INCLUDED" "${remaining[@]}"; then
                reason="conflicts in $conflict_list, and the agent failed or ran out of time"
                break
            fi
            summary=$(sanitize_summary <"$AGENT_OUTPUT")
            note="conflicts in $conflict_list resolved by an agent: $summary"
        fi

        mapfile -t unresolved < <(files_with_markers "${conflicted[@]}")
        if [[ ${#unresolved[@]} -gt 0 ]]; then
            reason="conflicts in $(printf '%s\n' "${unresolved[@]}" | as_code_list)${summary:+ (agent: $summary)}"
            break
        fi
        mapfile -t outside < <(changes_outside "${conflicted[@]}")
        if [[ ${#outside[@]} -gt 0 ]]; then
            reason="conflicts in $conflict_list, and the resolution also changed $(printf '%s\n' "${outside[@]}" | as_code_list)"
            break
        fi

        echo "    Typechecking the resolution"
        if typechecks; then
            break
        fi
        echo "    The resolution doesn't typecheck:"
        tail -n 20 "$TYPECHECK_LOG"
        # Forget it, so no later rebuild replays it
        "${GIT_RERERE[@]}" rerere forget -- "${conflicted[@]}" >/dev/null 2>&1 || true
        if [[ $attempts -eq 1 && ${#remaining[@]} -eq 0 ]] && has_agent; then
            # A replayed resolution no longer fits: let the agent try afresh
            git checkout --quiet -m -- "${conflicted[@]}"
            remaining=("${conflicted[@]}")
            continue
        fi
        reason="conflicts in $conflict_list, and the attempted resolution doesn't typecheck"
        break
    done

    if [[ -n "$reason" ]]; then
        abort_merge
        echo "    Left out: $reason"
        LEFT_OUT+="- #$number $title: $reason"$'\n'
        continue
    fi

    git add --all
    # Committing with rerere enabled records the resolution for later rebuilds
    "${GIT_RERERE[@]}" commit --quiet --no-edit
    INCLUDED+="$entry: $note"$'\n'
done 3<<< "$PRS"

BODY=$(cat <<EOF
Labs is a staff-only copy of the site: master plus every open PR labelled \`$LABEL\`. This branch is rebuilt from scratch by \`devTools/labs/rebuild-labs-branch.sh\`, so don't push to it or merge it. To put a feature on Labs, add the \`$LABEL\` label to its PR; to take it off, remove the label.

**Built from** master at \`$MASTER_SHA\`, plus:

${INCLUDED:-_No labelled PRs._}
EOF
)
if [[ -n "$LEFT_OUT" ]]; then
    BODY+=$'\n'"**Left out of this build:**"$'\n\n'"$LEFT_OUT"
fi

echo "--- Result"
echo "$BODY"

if [[ -n "$DRY_RUN" ]]; then
    echo "--- Dry run: not pushing"
    exit 0
fi

echo "--- Pushing $LABS_BRANCH"
# In GitHub Actions the checkout keeps no credentials, so push with the job's token
PUSH_REMOTE="origin"
if [[ "${GITHUB_ACTIONS:-}" == "true" ]]; then
    PUSH_REMOTE="https://x-access-token:${GH_TOKEN}@github.com/$REPO.git"
fi
git push --quiet --force "$PUSH_REMOTE" "HEAD:refs/heads/$LABS_BRANCH"

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
