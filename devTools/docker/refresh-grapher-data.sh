#!/usr/bin/env  bash
set -o errexit
set -o pipefail
set -o nounset
set -x

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
    cat $1 | gunzip | sed s/.\*DEFINER\=\`.\*// | _mysql $2
}

fillGrapherDb() {
    echo "==> Refreshing grapher database"

    TEMP_DB_NAME="${GRAPHER_DB_NAME}_temp"

    # Create a temporary database
    # _mysql --database="" -e "DROP DATABASE IF EXISTS $TEMP_DB_NAME; CREATE DATABASE $TEMP_DB_NAME; ALTER DATABASE $TEMP_DB_NAME CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs;"

    # if [ -f "${DATA_FOLDER}/owid_metadata.sql.gz" ]; then
    #     echo "Importing live Grapher metadata database into temporary database (owid_metadata)"
    #     import_db $DATA_FOLDER/owid_metadata.sql.gz $TEMP_DB_NAME
    # else
    #     echo "owid_metadata.sql.gz missing in ${DATA_FOLDER}. Refresh aborted."
    #     return 1
    # fi

    # echo "==> Drop owid database and recreate it"
    # _mysql --database="" -e "DROP DATABASE IF EXISTS $GRAPHER_DB_NAME;CREATE DATABASE $GRAPHER_DB_NAME;ALTER DATABASE $GRAPHER_DB_NAME CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs;"

    echo "==> Fill new DB with tables"
    tables=$(_mysql --batch --skip-column-names --database="" -e "SHOW TABLES IN $TEMP_DB_NAME")
    for table in $tables; do
        # TODO: doesn't work with views!!! we'd have to recreate them
        _mysql --database="" -e "RENAME TABLE $TEMP_DB_NAME.$table TO $GRAPHER_DB_NAME.$table;"
    done

    # Drop the original database and rename the temporary database to the original name
    # _mysql --database="" -e "DROP DATABASE IF EXISTS $GRAPHER_DB_NAME; RENAME DATABASE $TEMP_DB_NAME TO $GRAPHER_DB_NAME;"

    echo "==> ✅ Grapher DB refresh complete"
}

fillGrapherDb
