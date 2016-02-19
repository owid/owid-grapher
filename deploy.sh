#!/bin/bash
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
RSYNC="rsync -havz --no-perms --progress --delete --delete-excluded --exclude .git --exclude node_modules --exclude \"storage/logs/*\" --exclude \"storage/debugbar/*\" --exclude .env"
HOST="explain3@ourworldindata.org"
ROOT="/home/explain3"

if [ "$1" == "test" ]; then
  NAME="test-grapher"
elif [ "$1" == "live" ]; then
  NAME="grapher"
else
  echo "Please select either live or test."
  exit 1
fi

OLD_REPO="$ROOT/tmp/$NAME-old"
SYNC_TARGET="$ROOT/tmp/$NAME"
TMP_NEW="$ROOT/tmp/$NAME-new"
LIVE_TARGET="$ROOT/public_html/$NAME"
LIVE_DATA="$ROOT/$NAME-data"

ssh $HOST "rm -r $OLD_REPO"
$RSYNC $DIR/ $HOST:$SYNC_TARGET
ssh $HOST 'bash -l -e -s' <<EOF
  cp -r $SYNC_TARGET $TMP_NEW
  mv $LIVE_TARGET $OLD_REPO
  mv $TMP_NEW $LIVE_TARGET
  ln -s $LIVE_DATA/env $LIVE_TARGET/.env
  ln -s $LIVE_DATA/uploads $LIVE_TARGET/public/uploads
EOF
