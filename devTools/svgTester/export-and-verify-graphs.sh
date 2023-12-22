#!/usr/bin/env bash

usage() {
  echo -e "Usage: ./$(basename $0) [-c] [-t] [-q] [--views] [--skip-export] [-h | --help]

Export Grapher charts from master and verify them against the current branch.

    -c              config IDs passed to export-graphs.js and verify-graphs.js
    -t              chart types passed to export-graphs.js and verify-graphs.js
    -q              grapher query string passed to export-graphs.js and verify-graphs.js
    --all-views     generate all possible views for each grapher id (passed to export-graphs.js and verify-graphs.js)
    --skip-export   skip the export step (useful when running this script multiple times)
    -h, --help      display this help and exit
"
  exit
}

# internal constants
TMP_FILE=tmp-export-and-verify-graphs

# public constants
CONFIGS_DIR=../owid-grapher-svgs/configs
LOCAL_REFERENCE_DIR=../owid-grapher-svgs/local-svg
LOCAL_DIFFERENCES_DIR=../owid-grapher-svgs/local-differences
REPORT_FILE=../owid-grapher-svgs/local-differences.html

# parameter defaults
CONFIG_IDS_ARG=""
CHART_TYPES_ARG=""
GRAPHER_QUERY_STRING_ARG=""
VIEWS_ARG=""
SKIP_EXPORT=false

# Arguments parsing inspired by https://gist.github.com/jehiah/855086
parseArgs() {
    while [ "$1" != "" ]; do
        # split arg by the first occurence of '='
        PARAM="$(cut -d '=' -f 1 <<< "$1")"
        VALUE="$(cut -d '=' -f 2- <<< "$1")"
        case $PARAM in
            -h | --help)
                usage
                exit
                ;;
            -c)
                CONFIG_IDS=$VALUE
                CONFIG_IDS_ARG=$([ -z "$CONFIG_IDS" ] || echo "-c $CONFIG_IDS")
                ;;
            -t)
                CHART_TYPES=$VALUE
                CHART_TYPES_ARG=$([ -z "$CHART_TYPES" ] || echo "-t $CHART_TYPES")
                ;;
            -q)
                GRAPHER_QUERY_STRING=$VALUE
                GRAPHER_QUERY_STRING_ARG=$([ -z "$GRAPHER_QUERY_STRING" ] || echo "-q $GRAPHER_QUERY_STRING")
                ;;
            --views)
                VIEWS_ARG="--views"
                ;;
            --skip-export)
                SKIP_EXPORT=true
                ;;
            *)
                echo "ERROR: unknown parameter \"$PARAM\""
                usage
                exit 1
                ;;
        esac
        shift
    done
}

stashChanges() {
    # create temporary file to force the creation of a stash entry
    # (even if there are no changes to stash)
    touch $TMP_FILE

    echo "=> Stashing changes, including untracked files"
    git stash push -uq
}

unstashChanges() {
    echo "=> Popping changes from stash"
    git stash pop -q

    # remove temporary file
    rm $TMP_FILE
}

checkoutMaster() {
    echo "=> Checking out master"
    git checkout master

    echo "=> Build project"
    yarn buildLerna
    yarn buildTsc
}

checkoutLastBranch() {
    echo "=> Checking out last branch"
    git checkout - && echo "=> Checked out $(git branch --show-current)"

    echo "=> Build project"
    yarn buildLerna
    yarn buildTsc
}

runExportScript() {
    # start from a clean slate
    rm -rf $LOCAL_REFERENCE_DIR $LOCAL_DIFFERENCES_DIR 

    echo "=> Exporting graphs into $LOCAL_REFERENCE_DIR"
    node itsJustJavascript/devTools/svgTester/export-graphs.js\
        -i $CONFIGS_DIR\
        -o $LOCAL_REFERENCE_DIR\
        $CONFIG_IDS_ARG\
        $CHART_TYPES_ARG\
        $GRAPHER_QUERY_STRING_ARG\
        $VIEWS_ARG
}

runVerifyScript() {
    echo "=> Verifying graphs and storing differences in $LOCAL_DIFFERENCES_DIR"
    node itsJustJavascript/devTools/svgTester/verify-graphs.js\
        -i $CONFIGS_DIR\
        -r $LOCAL_REFERENCE_DIR\
        -o $LOCAL_DIFFERENCES_DIR\
        $CONFIG_IDS_ARG\
        $CHART_TYPES_ARG\
        $GRAPHER_QUERY_STRING_ARG\
        $VIEWS_ARG
}

createHTMLReport() {
    echo "=> Creating HTML report at $REPORT_FILE"
    node itsJustJavascript/devTools/svgTester/create-compare-view.js\
        -r $LOCAL_REFERENCE_DIR\
        -d $LOCAL_DIFFERENCES_DIR\
        -o $REPORT_FILE
}

main() {
    # if not skipped, run the export script on master
    if [ "$SKIP_EXPORT" = false ] ; then
        # store original state
        stashChanges

        # run export script on master
        checkoutMaster
        runExportScript

        # restore original state
        checkoutLastBranch
        unstashChanges
    fi
    
    # verify grapher charts and create an html report if there are differences
    runVerifyScript || createHTMLReport
}

parseArgs "$@"
main
