#!/usr/bin/env bash

set -o errexit  # exit script when a command fails
set -o nounset  # fail when accessing an unset variable
set -o pipefail  # treats pipeline command as failed when one command in the pipeline fails

SVGS_REPO=../owid-grapher-svgs

usage() {
  echo -e "Usage: ./$(basename "$0") [-h | --help]

Dump a new set of configs and generate reference SVGs.
Make sure to run \`make refresh\` and \`make refresh.pageviews\` before running this script."
}

refresh() {
    local testSuite=$1
    local path=$SVGS_REPO/$testSuite

    echo "=> Dumping configs and data ($testSuite)"
    rm -rf $path/data
    yarn tsx --tsconfig tsconfig.tsx.json devTools/svgTester/dump-data.ts \
        $testSuite

    echo "=> Committing configs and chart ids ($testSuite)"
    cd $SVGS_REPO \
        && git add --all \
        && (git diff --cached --quiet || git commit -m "chore: update configs and data ($testSuite)") \
        && cd -

    echo "=> Generating reference SVGs ($testSuite)"
    rm -rf $path/references
    yarn tsx --tsconfig tsconfig.tsx.json devTools/svgTester/export-graphs.ts \
        $testSuite

    echo "=> Committing reference SVGs ($testSuite)"
    cd $SVGS_REPO \
        && git add --all \
        && (git diff --cached --quiet || git commit -m "chore: update reference svgs ($testSuite)") \
        && cd -
}

main() {
    echo "=> Resetting owid-grapher-svgs to origin/master"
    cd $SVGS_REPO \
        && git fetch \
        && git checkout -f master \
        && git reset --hard origin/master \
        && git clean -fdx \
        && cd -

    refresh graphers
    refresh grapher-views
    refresh mdims
    refresh explorers
    refresh thumbnails
}

# show help
if [[ "${1-}" =~ ^-*h(elp)?$ ]]; then
  usage
  exit
fi

main
