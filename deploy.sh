#!/bin/bash
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
RSYNC="rsync -havz --no-perms --progress"
$RSYNC $DIR/public owid:/home/explain3/public_html/grapher
$RSYNC $DIR/resources owid:/home/explain3/public_html/grapher/
$RSYNC $DIR/app owid:/home/explain3/public_html/grapher/
$RSYNC $DIR/bootstrap owid:/home/explain3/public_html/grapher/
