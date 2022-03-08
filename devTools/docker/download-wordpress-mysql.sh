#!/usr/bin/env  bash

# This script assumes that you have ssh access to the OWID production server called owid-live. It will
# fail if you don't have these credentials

set -o errexit
set -o pipefail
set -o nounset

FOLDER="${DATA_FOLDER:-./tmp-downloads}"

mkdir -p $FOLDER

ssh owid-live "sudo mysqldump --default-character-set=utf8mb4 live_wordpress -r /tmp/live_wordpress.sql && sudo gzip -f /tmp/live_wordpress.sql"
rsync -hav --progress owid-live:/tmp/live_wordpress.sql.gz $FOLDER
