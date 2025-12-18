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
    local dir=$1
    local dump_flags=${2:-}
    local export_flags=${3:-}

    local path=$SVGS_REPO/$dir

    echo "=> Dumping configs and data ($dir)"
    rm -rf $path/data
    yarn tsx --tsconfig tsconfig.tsx.json devTools/svgTester/dump-data.ts \
        -o $path/data \
        $dump_flags

    echo "=> Committing configs and chart ids ($dir)"
    cd $SVGS_REPO \
        && git add --all \
        && git commit -m "chore: update configs and chart ids ($dir)" \
        && cd -

    echo "=> Generating reference SVGs ($dir)"
    rm -rf $path/references
    yarn tsx --tsconfig tsconfig.tsx.json devTools/svgTester/export-graphs.ts \
        -i $path/data \
        -o $path/references \
        $export_flags

    echo "=> Committing reference SVGs ($dir)"
    cd $SVGS_REPO \
        && git add --all \
        && git commit -m "chore: update reference svgs ($dir)" \
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
    refresh grapher-views "--top 25" "--all-views"
}

# show help
if [[ "${1-}" =~ ^-*h(elp)?$ ]]; then
  usage
  exit
fi

main
