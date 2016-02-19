#!/bin/bash
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
RSYNC="rsync -havz --no-perms --progress --exclude config/database.php --exclude .git --exclude node_modules --exclude storage/logs --exclude .env"
$RSYNC $DIR/ owid:/home/explain3/public_html/grapher
