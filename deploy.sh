#!/bin/bash -e
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
RSYNC="rsync -havz --no-perms --progress --delete --delete-excluded --exclude-from=$DIR/.rsync-ignore"
HOST="owid@terra"
ROOT="/home/owid"

if [ "$1" == "test" ]; then
  NAME="test-grapher"
  DB_NAME="test_grapher"
elif [ "$1" == "mispytest" ]; then
  NAME="mispytest-grapher"
  DB_NAME="mispytest_grapher"
elif [ "$1" == "live" ]; then
  NAME="live-grapher"
  DB_NAME="live_grapher"

  # Prompt for confirmation if deploying to live
  read -p "Are you sure you want to deploy to '$NAME'? " -n 1 -r
  echo
else
  echo "Please select either live or test."
  exit 1
fi

if [[ $REPLY =~ ^[Yy]$ ]] || [ "$1" != "live" ]
then
  OLD_REPO_BACKUP="$ROOT/tmp/$NAME-old"
  SYNC_TARGET="$ROOT/tmp/$NAME-$USER"
  TMP_NEW="$ROOT/tmp/$NAME-$USER-tmp"
  FINAL_TARGET="$ROOT/$NAME-code"
  FINAL_DATA="$ROOT/$NAME-data"

  # Rsync the local repository to a temporary location on the server
  $RSYNC $DIR/ $HOST:$SYNC_TARGET

  ssh -t $HOST 'bash -e -s' <<EOF
  # Remove any previous temporary repo
  rm -rf $TMP_NEW

  # Copy the synced repo-- this is because we're about to move it, and we want the
  # original target to stay around to make future syncs faster
  cp -r $SYNC_TARGET $TMP_NEW

  # Atomically swap the old and new versions
  rm -rf $OLD_REPO_BACKUP
  mv $FINAL_TARGET $OLD_REPO_BACKUP || true
  mv $TMP_NEW $FINAL_TARGET

  # Link in all the persistent stuff that needs to stay around between versions
  ln -sf $FINAL_DATA/.env $FINAL_TARGET/.env
  ln -sf $FINAL_DATA/env $FINAL_TARGET/env
  ln -sf $FINAL_DATA/public $FINAL_TARGET/
  ln -sf $FINAL_DATA/data $FINAL_TARGET/data
  ln -sf $FINAL_TARGET/public $ROOT/ourworldindata.org/$NAME

  # Install dependencies and migrate
  cd $FINAL_TARGET
  yarn install --production
  . env/bin/activate
  pip3 install -r requirements.txt
  python3 manage.py migrate
  ./node_modules/.bin/webpack -p

  # Static build to update the public frontend code
  node dist/src/bakeCharts.js

  # Finally, restart the admin!
  sudo service $NAME restart
EOF
fi

