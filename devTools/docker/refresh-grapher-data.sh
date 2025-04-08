#!/usr/bin/env  bash
set -o errexit
set -o pipefail
set -o nounset

if [ -e .env ]; then
    source .env
fi

: "${GRAPHER_DB_NAME:?Need to set GRAPHER_DB_NAME non-empty}"
: "${GRAPHER_DB_USER:?Need to set GRAPHER_DB_USER non-empty}"
: "${GRAPHER_DB_PASS:-Need to set GRAPHER_DB_PASS}"
: "${GRAPHER_DB_HOST:?Need to set GRAPHER_DB_HOST non-empty}"
: "${GRAPHER_DB_PORT:?Need to set GRAPHER_DB_PORT non-empty}"
: "${DATA_FOLDER:?Need to set DATA_FOLDER non-empty}"

_mysql() {
    if [ -z "$GRAPHER_DB_PASS" ]; then
        mysql --default-character-set=utf8mb4 -h"$GRAPHER_DB_HOST" -u"$GRAPHER_DB_USER" -P "${GRAPHER_DB_PORT}" "$@"
    else
        mysql --default-character-set=utf8mb4 -h"$GRAPHER_DB_HOST" -u"$GRAPHER_DB_USER" -p"$GRAPHER_DB_PASS" -P "${GRAPHER_DB_PORT}" "$@"
    fi
}

import_db() {
    cat $1 | gunzip | sed s/.\*DEFINER\=\`.\*// | grep -vF GLOBAL.GTID_PURGED | _mysql $GRAPHER_DB_NAME
}

fillGrapherDb() {
    echo "==> Refreshing grapher database"

    # Create a backup database name with timestamp
    BACKUP_DB_NAME="${GRAPHER_DB_NAME}_bak_$(date +%s)"

    # Check if the original database exists
    DB_EXISTS=$(_mysql --database="" -e "SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME='$GRAPHER_DB_NAME'" 2>/dev/null | grep -c "$GRAPHER_DB_NAME" || true)

    # If it exists, rename it instead of dropping it
    if [ "$DB_EXISTS" -gt 0 ]; then
        echo "Renaming existing database to $BACKUP_DB_NAME"
        _mysql --database="" -e "CREATE DATABASE IF NOT EXISTS $BACKUP_DB_NAME;
                                 RENAME TABLES
                                 $GRAPHER_DB_NAME.* TO $BACKUP_DB_NAME.*;"
    fi

    # Create a new database
    _mysql --database="" -e "DROP DATABASE IF EXISTS $GRAPHER_DB_NAME;
                             CREATE DATABASE $GRAPHER_DB_NAME;
                             ALTER DATABASE $GRAPHER_DB_NAME CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs;"

    # Import data
    if [ -f "${DATA_FOLDER}/owid_metadata.sql.gz" ]; then
        echo "Importing live Grapher metadata database (owid_metadata)"
        import_db $DATA_FOLDER/owid_metadata.sql.gz

        # If we got here, the import was successful, so drop the backup
        if [ "$DB_EXISTS" -gt 0 ]; then
            echo "Dropping backup database $BACKUP_DB_NAME"
            _mysql --database="" -e "DROP DATABASE IF EXISTS $BACKUP_DB_NAME;"
        fi
    else
        echo "owid_metadata.sql.gz missing in ${DATA_FOLDER}. Refresh aborted."

        # If import fails and we had an original database, restore the original by renaming it back
        if [ "$DB_EXISTS" -gt 0 ]; then
            echo "Restoring original database from $BACKUP_DB_NAME"
            _mysql --database="" -e "DROP DATABASE IF EXISTS $GRAPHER_DB_NAME;
                                     RENAME DATABASE $BACKUP_DB_NAME TO $GRAPHER_DB_NAME;"
        fi
        return 1
    fi

    echo "==> ✅ Grapher DB refresh complete"
}

fillGrapherDb
