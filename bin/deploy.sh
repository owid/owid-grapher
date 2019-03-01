#!/bin/bash -e
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && cd .. && pwd )"
RSYNC="rsync -havz --no-perms --progress --delete --delete-excluded --exclude-from=$DIR/.rsync-ignore"
HOST="owid@terra"
ROOT="/home/owid"

if [ "$1" == "mispytest" ]; then
  NAME="mispytest"
  WORDPRESS_DIR="/home/owid/mispytest-wordpress"
elif [ "$1" == "danieltest" ]; then
  NAME="danieltest"
  WORDPRESS_DIR="/home/owid/danieltest-wordpress"
elif [ "$1" == "live" ]; then
  NAME="live"
  WORDPRESS_DIR="/home/owid/owid.cloud"

  # Prompt for confirmation if deploying to live
  read -p "Are you sure you want to deploy to '$NAME'? " -n 1 -r
  echo
else
  echo "Please select either live or a valid test target."
  exit 1
fi

if [[ $REPLY =~ ^[Yy]$ ]] || [ "$1" != "live" ]
then
  OLD_REPO_BACKUP="$ROOT/tmp/$NAME-old"
  SYNC_TARGET="$ROOT/tmp/$NAME-$USER"
  TMP_NEW="$ROOT/tmp/$NAME-$USER-tmp"
  FINAL_TARGET="$ROOT/$NAME"
  FINAL_DATA="$ROOT/$NAME-data"

  # Run pre-deploy checks
  yarn testcheck

  # Rsync the local repository to a temporary location on the server
  $RSYNC $DIR/ $HOST:$SYNC_TARGET

  ssh -t $HOST 'bash -e -s' <<EOF
  # Remove any previous temporary repo
  rm -rf $TMP_NEW

  # Copy the synced repo-- this is because we're about to move it, and we want the
  # original target to stay around to make future syncs faster
  cp -r $SYNC_TARGET $TMP_NEW

  # Link in all the persistent stuff that needs to stay around between versions
  ln -sf $FINAL_DATA/.env $TMP_NEW/.env
  mkdir -p $FINAL_DATA/bakedSite
  ln -sf $FINAL_DATA/bakedSite $TMP_NEW/bakedSite
  mkdir -p $FINAL_DATA/datasetsExport
  ln -sf $FINAL_DATA/datasetsExport $TMP_NEW/datasetsExport

  # Install dependencies, build assets and migrate
  cd $TMP_NEW
  yarn install --production
  yarn build
  yarn typeorm migration:run
  yarn migrate
  yarn tsn scripts/configureAlgolia.ts

  # Atomically swap the old and new versions
  rm -rf $OLD_REPO_BACKUP
  mv $FINAL_TARGET $OLD_REPO_BACKUP || true
  mv $TMP_NEW $FINAL_TARGET

  # Restart the admin!
  sudo service $NAME restart

  # Hook into Wordpress
  rm -rf $WORDPRESS_DIR/wp-content/themes/owid-theme && cp -r $FINAL_TARGET/theme $WORDPRESS_DIR/wp-content/themes/owid-theme
  ln -sf $FINAL_TARGET $WORDPRESS_DIR/wp-content/themes/owid-theme/codelink

  # Static build to update the public frontend code
  cd $FINAL_TARGET
  yarn tsn scripts/bakeSite.ts
EOF
fi
