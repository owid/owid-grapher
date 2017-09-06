#!/bin/bash
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
else
  echo "Please select either live or test."
  exit 1
fi

OLD_REPO="$ROOT/tmp/$NAME-old"
SYNC_TARGET="$ROOT/tmp/$NAME"
TMP_NEW="$ROOT/tmp/$NAME-new"
LIVE_TARGET="$ROOT/$NAME-code"
LIVE_DATA="$ROOT/$NAME-data"

if [ "$2" != "no-webpack" ]; then
  yarn build
fi

ssh -t $HOST "mkdir -p $ROOT/tmp; rm -rf $OLD_REPO"
$RSYNC $DIR/ $HOST:$SYNC_TARGET
ssh -t $HOST 'bash -e -s' <<EOF
  cp -r $SYNC_TARGET $TMP_NEW
  mv $LIVE_TARGET $OLD_REPO
  mv $TMP_NEW $LIVE_TARGET
  ln -sf $LIVE_DATA/secret_settings.py $LIVE_TARGET/owid_grapher/secret_settings.py
  ln -sf $LIVE_DATA/env $LIVE_TARGET/env
  ln -sf $LIVE_DATA/uploads $LIVE_TARGET/public/uploads
  ln -sf $LIVE_DATA/exports $LIVE_TARGET/public/exports
  ln -sf $LIVE_DATA/data $LIVE_TARGET/data
  ln -sf $LIVE_TARGET/public $ROOT/ourworldindata.org/$NAME
  cd $LIVE_TARGET
  yarn install --production
  ./env/bin/pip3 install -r requirements.txt
  ./env/bin/python3 manage.py migrate
  sudo chown owid:www-data -R $LIVE_TARGET
  sudo chown owid:www-data -R $LIVE_DATA
  sudo chmod g+rw -R /home/owid/* || true
  sudo service $NAME restart
EOF

