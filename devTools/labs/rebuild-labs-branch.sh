#!/usr/bin/env bash
#
# Rebuild the `labs` branch from scratch: origin/master plus every open PR
# labelled `labs`, merged in PR-number order, then force-push it. Pushing the
# branch is what deploys Labs: its draft PR gets a staging server like any other.
#
# A PR that doesn't merge cleanly is left out of this round and listed in the
# Labs PR description; merging master into it (or resolving the clash with the
# PR it conflicts with) brings it back on the next rebuild.
#
# Usage: devTools/labs/rebuild-labs-branch.sh [--dry-run]
#   --dry-run  build the branch locally and print the result, but don't push

set -o errexit
set -o pipefail
set -o nounset

REPO="owid/owid-grapher"
LABEL="labs"
LABS_BRANCH="labs"
LABS_PR_TITLE="Labs (DO NOT MERGE)"

DRY_RUN=""
if [[ "${1:-}" == "--dry-run" ]]; then
    DRY_RUN=1
fi

REPO_ROOT=$(git rev-parse --show-toplevel)
WORKTREE=$(mktemp -d "${TMPDIR:-/tmp}/labs-rebuild.XXXXXX")

cleanup() {
    git -C "$REPO_ROOT" worktree remove --force "$WORKTREE" 2>/dev/null || true
}
trap cleanup EXIT

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
    if git merge --no-ff --no-edit --quiet -m "Labs: merge #$number $title" "$sha"; then
        INCLUDED+="- #$number $title (\`${sha:0:7}\`)"$'\n'
    else
        CONFLICTS=$(git diff --name-only --diff-filter=U | sed 's/^/`/; s/$/`/' | paste -sd ',' - | sed 's/,/, /g')
        git merge --abort
        echo "    Left out: conflicts in $CONFLICTS"
        LEFT_OUT+="- #$number $title: conflicts in $CONFLICTS"$'\n'
    fi
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
    # staging-https: the badge's "Copy public link" needs a secure context.
    # staging-algolia: a search index of its own, or /search 404s on staging servers.
    # pinned: keeps the stale bot from closing the PR, and with it the Labs server.
    gh pr create --repo "$REPO" --draft --base master --head "$LABS_BRANCH" \
        --title "$LABS_PR_TITLE" --label staging-https --label staging-algolia --label pinned --body "$BODY"
else
    echo "--- Updating the description of #$LABS_PR"
    gh pr edit "$LABS_PR" --repo "$REPO" --body "$BODY"
fi
