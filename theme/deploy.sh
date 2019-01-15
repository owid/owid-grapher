#!/bin/bash
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
RSYNC="rsync -havz --no-perms --progress --delete --delete-excluded --exclude-from=$DIR/.rsync-ignore"

if [ "$1" == "test" ]; then
  HOST="owid@terra"
  ENV="test"
  WORDPRESS_DIR="/home/owid/test.ourworldindata.org"
elif [ "$1" == "mispytest" ]; then
  HOST="owid@terra"
  ENV="mispytest"
  WORDPRESS_DIR="/home/owid/mispytest-wordpress"
elif [ "$1" == "live" ]; then
  ENV="live"
  HOST="owid@terra"
  WORDPRESS_DIR="/home/owid/ourworldindata.org"

  # Prompt for confirmation if deploying to live
  read -p "Are you sure you want to deploy to 'live'? " -n 1 -r
  echo
else
  echo "Please select either live or test."
  exit 1
fi

if [[ $REPLY =~ ^[Yy]$ ]] || [ "$1" != "live" ]
then
  TMP="/home/owid/tmp"
  OLD_REPO="$TMP/$ENV-owid-theme-old"
  SYNC_TARGET="$TMP/$ENV-owid-theme"
  TMP_NEW="$TMP/$ENV-owid-theme-new"
  FINAL_TARGET="$WORDPRESS_DIR/wp-content/themes/owid-theme"
  DATA="/home/owid/$ENV-theme-data"

  ssh -t $HOST "rm -rf $OLD_REPO"
  $RSYNC $DIR/ $HOST:$SYNC_TARGET
  ssh -t $HOST 'bash -e -s' <<EOF
    cp -r $SYNC_TARGET $TMP_NEW
    mv $FINAL_TARGET $OLD_REPO
    mv $TMP_NEW $FINAL_TARGET

    ln -sf $DATA/.env $FINAL_TARGET/.env

    cd $FINAL_TARGET
    yarn install --production
    yarn build
    node dist/src/deployHook.js
EOF
fi
