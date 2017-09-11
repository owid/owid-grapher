#!/bin/bash -e
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
RSYNC="rsync -havz --no-perms --progress --delete --delete-excluded --exclude-from=$DIR/.rsync-ignore"
HOST="owid@terra"
ROOT="/home/owid"

if [ "$1" == "test" ]; then
  NAME="test-grapher"
elif [ "$1" == "mispytest" ]; then
  NAME="mispytest-grapher"
elif [ "$1" == "live" ]; then
  NAME="live-grapher"

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

  if [ "$2" != "no-webpack" ]; then
    yarn build
  fi

  # Rsync the local repository to a temporary location on the server
  $RSYNC $DIR/ $HOST:$SYNC_TARGET

  ssh -t $HOST 'bash -e -s' <<EOF
  # Remove any previous temporary repo
  rm -rf $TMP_NEW

  # Copy the synced repo-- this is because we're about to move it, and we want the
  # original target to stay around to make future syncs faster
  cp -r $SYNC_TARGET $TMP_NEW

  # Merge the build with what's currently on the server to preserve old cached bundles
  cp -r $TMP_NEW/public/build $FINAL_DATA/
  rm -rf $TMP_NEW/public/build

  # Atomically swap the old and new versions
  rm -rf $OLD_REPO_BACKUP
  mv $FINAL_TARGET $OLD_REPO_BACKUP || true
  mv $TMP_NEW $FINAL_TARGET

  # Link in all the persistent stuff that needs to stay around between versions
  ln -sf $FINAL_DATA/secret_settings.py $FINAL_TARGET/owid_grapher/secret_settings.py
  ln -sf $FINAL_DATA/env $FINAL_TARGET/env
  ln -sf $FINAL_DATA/build $FINAL_TARGET/public/build
  ln -sf $FINAL_DATA/uploads $FINAL_TARGET/public/uploads
  ln -sf $FINAL_DATA/exports $FINAL_TARGET/public/exports
  ln -sf $FINAL_DATA/data $FINAL_TARGET/data
  ln -sf $FINAL_TARGET/public $ROOT/ourworldindata.org/$NAME

  # Install dependencies and migrate
  cd $FINAL_TARGET
  yarn install --production
  ./env/bin/pip3 install -r requirements.txt
  ./env/bin/python3 manage.py migrate

  # Ensure consistent permissions
  sudo chown owid:www-data -R $FINAL_TARGET
  sudo chown owid:www-data -R $FINAL_DATA
  sudo chmod g+rw -R $FINAL_TARGET || true
  sudo chmod g+rw -R $FINAL_DATA || true

  # Finally, restart the grapher!
  sudo service $NAME restart
EOF
fi

