#!/bin/bash -e

################################################
# Deploy from dev to staging targets or live #
################################################

USER="$(id -un)" # $USER empty in vscode terminal
BRANCH="$(git branch --show-current)"
WORDPRESS_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && cd .. && pwd )"
PATH_OWID_PLUGIN="web/app/plugins/owid"
ROOT="/home/owid"

if [[ "$1" =~ ^(staging|hans|playfair|jefferson|nightingale|explorer|exemplars|tufte|roser)$ ]]; then
  HOST="owid-staging"
elif [ "$1" == "live" ]; then
  HOST="owid-live"

  if [ "$BRANCH" != "master" ]; then
    echo "Please run from the master branch."
    exit 1
  else
    # Making sure we have the latest changes from the upstream
    # Also, will fail if working copy is not clean
    git pull --rebase
  fi

  # Prompt for confirmation if deploying to live
  read -p "Are you sure you want to deploy to '$1'? " -n 1 -r
else
  echo "Please select either live or a valid test target."
  exit 1
fi

if [[ $REPLY =~ ^[Yy]$ ]] || [ "$1" != "live" ]; then
  NAME="$1-wordpress"
  OLD_REPO_BACKUP="$ROOT/tmp/$NAME-old"
  SYNC_TARGET="$ROOT/tmp/$NAME-$USER"
  TMP_NEW="$ROOT/tmp/$NAME-$USER-tmp"
  FINAL_TARGET="$ROOT/$NAME"
  FINAL_DATA="$ROOT/$1-data"
  GRAPHER_DIR="$ROOT/$1"

  # Rsync the local repository to a temporary location on the server
  echo 'Uploading files...'
  rsync -havz --progress --delete --delete-excluded --filter="merge $WORDPRESS_DIR/.rsync-filter" $WORDPRESS_DIR/ $HOST:$SYNC_TARGET

  echo 'Performing atomic copy...'
  ssh -t $HOST 'bash -e -s' <<EOF

  # Ensure target directories exist
  mkdir -p $ROOT/tmp
  mkdir -p $FINAL_TARGET

  # Remove any previous temporary repo
  rm -rf $TMP_NEW

  # Copy the synced repo-- this is because we're about to move it, and we want the
  # original target to stay around to make future syncs faster
  cp -r $SYNC_TARGET $TMP_NEW

  # Install dependencies, build assets
  cd $TMP_NEW
  composer install --no-dev
  cd $TMP_NEW/$PATH_OWID_PLUGIN
  yarn install
  yarn build

  # Link in all the persistent stuff that needs to stay around between versions
  ln -s $FINAL_DATA/wordpress/.env $TMP_NEW/.env
  ln -s $FINAL_DATA/wordpress/uploads $TMP_NEW/web/app/uploads
  ln -s $GRAPHER_DIR $TMP_NEW/web/wp/codelink

  # Atomically swap the old and new versions
  rm -rf $OLD_REPO_BACKUP
  mv $FINAL_TARGET $OLD_REPO_BACKUP || true
  mv $TMP_NEW $FINAL_TARGET
EOF
fi
