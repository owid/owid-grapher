#!/bin/bash -e

NAME="$1" # target server to deploy to

if [ "$NAME" == "live" ]; then
  if [ "$(git rev-parse --abbrev-ref HEAD)" != "master" ]; then
    echo "Please run from the master branch."
    exit 1
  else
    # Making sure we have the latest changes from the upstream
    # Also, will fail if working copy is not clean
    git pull --rebase
  fi

  # Prompt for confirmation if deploying to live
  read -p "Are you sure you want to deploy to '$NAME'? " -n 1 -r
  echo
  if [[ $REPLY =~ ^[^Yy]$ ]]; then
    exit 0
  fi
fi

yarn cleanTsc
yarn buildTsc
node ./itsJustJavascript/baker/buildAndDeploySite.js "$@"
