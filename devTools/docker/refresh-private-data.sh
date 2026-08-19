#!/usr/bin/env  bash
set -o errexit
set -o pipefail
set -o nounset

# Imports the private sidecar dump (owid_private.sql.gz, downloaded by
# download-grapher-private-mysql.sh) into the grapher database. The dump
# contains DROP TABLE + CREATE TABLE + INSERTs, so importing fully replaces
# the PRIVATE_DATA_TABLES. Run after the public dump so foreign keys resolve.

if [ -e .env ]; then
    source .env
fi

: "${GRAPHER_DB_NAME:?Need to set GRAPHER_DB_NAME non-empty}"
: "${GRAPHER_DB_USER:?Need to set GRAPHER_DB_USER non-empty}"
: "${GRAPHER_DB_PASS:-Need to set GRAPHER_DB_PASS}"
: "${GRAPHER_DB_HOST:?Need to set GRAPHER_DB_HOST non-empty}"
: "${GRAPHER_DB_PORT:?Need to set GRAPHER_DB_PORT non-empty}"
: "${DATA_FOLDER:?Need to set DATA_FOLDER non-empty}"

if [ ! -f "${DATA_FOLDER}/owid_private.sql.gz" ]; then
    echo "owid_private.sql.gz missing in ${DATA_FOLDER} — nothing to import (private tables stay empty)"
    exit 0
fi

_mysql() {
    if [ -z "$GRAPHER_DB_PASS" ]; then
        mysql --default-character-set=utf8mb4 -h"$GRAPHER_DB_HOST" -u"$GRAPHER_DB_USER" -P "${GRAPHER_DB_PORT}" "$@"
    else
        mysql --default-character-set=utf8mb4 -h"$GRAPHER_DB_HOST" -u"$GRAPHER_DB_USER" -p"$GRAPHER_DB_PASS" -P "${GRAPHER_DB_PORT}" "$@"
    fi
}

echo "==> Importing private tables into $GRAPHER_DB_NAME"
cat ${DATA_FOLDER}/owid_private.sql.gz | gunzip | sed s/.\*DEFINER\=\`.\*// | grep -vF GLOBAL.GTID_PURGED | _mysql $GRAPHER_DB_NAME
echo "==> Private tables refreshed"
