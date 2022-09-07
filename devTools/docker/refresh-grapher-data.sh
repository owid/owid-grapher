#!/usr/bin/env  bash
set -o errexit
set -o pipefail
set -o nounset

: "${GRAPHER_DB_NAME:?Need to set GRAPHER_DB_NAME non-empty}"
: "${GRAPHER_DB_USER:?Need to set GRAPHER_DB_USER non-empty}"
: "${DB_ROOT_PASS:?Need to set DB_ROOT_PASS non-empty}"
: "${DB_ROOT_HOST:?Need to set DB_ROOT_HOST non-empty}"
: "${DATA_FOLDER:?Need to set DATA_FOLDER non-empty}"

_mysql() {
    mysql --default-character-set=utf8mb4 -h"$DB_ROOT_HOST" -uroot -p"$DB_ROOT_PASS" -P 3306 "$@"
}

import_db(){
  cat $1 | gunzip | sed s/.\*DEFINER\=\`.\*// | _mysql $GRAPHER_DB_NAME
}

fillGrapherDb() {
    echo "==> Refreshing grapher database"
    _mysql -e "DROP DATABASE IF EXISTS $GRAPHER_DB_NAME;CREATE DATABASE $GRAPHER_DB_NAME;"

    if [ -f "${DATA_FOLDER}/owid_metadata.sql.gz" ]; then
        echo "Importing live Grapher metadata database (owid_metadata)"
        import_db $DATA_FOLDER/owid_metadata.sql.gz
    else
        echo "owid_metata.sql.gz missing in ${DATA_FOLDER}. Refresh aborted."
        return 1;
    fi

    if [ -f "${DATA_FOLDER}/owid_chartdata.sql.gz" ]; then
        echo "Importing live Grapher chartdata database (owid_chartdata)"
        # import_db $DATA_FOLDER/owid_chartdata.sql.gz
    else
        echo "Skipping import of owid_chartdata (owid_chartdata.sql.gz missing in ${DATA_FOLDER})"
        # This is a legitimate use case, so execution should continue.
    fi
    echo "==> ✅ Grapher DB refresh complete"
}

fillGrapherDb
