#!/bin/bash -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && cd .. && pwd )"
USER="$(id -un)" # $USER empty in vscode terminal
BRANCH="$(git rev-parse --abbrev-ref HEAD)" # use "git branch --show-current" when git updated
GIT_STATUS="$(git status --porcelain)"
PATH_OWID_PLUGIN="web/app/plugins/owid"

if [ "$BRANCH" != "master" ] || [ -n "$GIT_STATUS" ]; then
  echo "Please run from a clean master branch."
  git status --porcelain
  exit 1
fi

if [ "$1" == "staging" ]; then
  HOST="owid-staging"
  ROOT="/home/owid"
  PREFIX="staging"
  NAME="$PREFIX-wordpress"
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
  FINAL_DATA="$ROOT/$PREFIX-data"

  # Rsync the local repository to a temporary location on the server
  echo 'Uploading files...'
  rsync -havz --progress --delete --delete-excluded --filter="merge .rsync-filter" $DIR/ $HOST:$SYNC_TARGET

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

  # Link in all the persistent stuff that needs to stay around between versions
  ln -s $FINAL_DATA/wordpress/.env $TMP_NEW/.env
  ln -s $FINAL_DATA/wordpress/uploads $TMP_NEW/web/app/uploads

  # Install dependencies, build assets
  cd $TMP_NEW
  composer install --no-dev
  cd $TMP_NEW/$PATH_OWID_PLUGIN
  yarn install
  yarn build

  # Atomically swap the old and new versions
  rm -rf $OLD_REPO_BACKUP
  mv $FINAL_TARGET $OLD_REPO_BACKUP || true
  mv $TMP_NEW $FINAL_TARGET
EOF
fi
