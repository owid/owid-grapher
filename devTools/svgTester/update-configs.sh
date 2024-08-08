#!/usr/bin/env bash

set -o errexit  # exit script when a command fails
set -o nounset  # fail when accessing an unset variable
set -o pipefail  # treats pipeline command as failed when one command in the pipeline fails

CONFIGS_DIR=../owid-grapher-svgs/configs
REFERENCES_DIR=../owid-grapher-svgs/svg
ALL_VIEWS_DIR=../owid-grapher-svgs/all-views/svg
CHART_IDS_FILE=most-viewed-charts.txt

usage() {
  echo -e "Usage: ./$(basename $0) [-h | --help]

Dump a new set of configs and generate reference SVGs.
Make sure to run \`make refresh\` and \`make refresh.pageviews\` before running this script."
}

main() {
    echo "=> Removing existing configs and reference svgs"
    rm -rf $CONFIGS_DIR $REFERENCES_DIR $ALL_VIEWS_DIR

    echo "=> Dump new configs and data"
    node itsJustJavascript/devTools/svgTester/dump-data.js -o $CONFIGS_DIR
    node itsJustJavascript/devTools/svgTester/dump-chart-ids.js -o $CHART_IDS_FILE

    echo "=> Generate reference SVGs"
    node itsJustJavascript/devTools/svgTester/export-graphs.js -i $CONFIGS_DIR -o $REFERENCES_DIR
    node itsJustJavascript/devTools/svgTester/export-graphs.js -i $CONFIGS_DIR -o $ALL_VIEWS_DIR -f $CHART_IDS_FILE --all-views
}

# show help
if [[ "${1-}" =~ ^-*h(elp)?$ ]]; then
  usage
  exit
fi

main
