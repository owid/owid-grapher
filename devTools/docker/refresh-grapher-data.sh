#!/usr/bin/env  bash
set -o errexit
set -o pipefail
set -o nounset

: "${GRAPHER_DB_NAME:?Need to set GRAPHER_DB_NAME non-empty}"
: "${GRAPHER_DB_USER:?Need to set GRAPHER_DB_USER non-empty}"
: "${GRAPHER_DB_PASS:?Need to set GRAPHER_DB_PASS non-empty}"
: "${DB_ROOT_HOST:?Need to set DB_ROOT_HOST non-empty}"
: "${DB_ROOT_PASS:?Need to set DB_ROOT_PASS non-empty}"
: "${DATA_FOLDER:?Need to set DATA_FOLDER non-empty}"

MYSQL="mysql --default-character-set=utf8mb4"

import_db(){
  cat $1 | gunzip | sed s/.\*DEFINER\=\`.\*// | $MYSQL -h$DB_ROOT_HOST -u$GRAPHER_DB_USER -p$GRAPHER_DB_PASS $GRAPHER_DB_NAME
}

fillGrapherDb() {
    echo "Refreshing grapher database"
    $MYSQL -h $DB_ROOT_HOST -uroot -p$DB_ROOT_PASS -e "DROP DATABASE IF EXISTS $GRAPHER_DB_NAME;CREATE DATABASE $GRAPHER_DB_NAME; GRANT ALL PRIVILEGES ON $GRAPHER_DB_NAME.* TO '$GRAPHER_DB_USER'"

    if [ -f "${DATA_FOLDER}/owid_metadata.sql.gz" ]; then
        echo "Importing live Grapher metadata database (owid_metadata)"
        import_db $DATA_FOLDER/owid_metadata.sql.gz
    fi

    if [ -f "${DATA_FOLDER}/owid_chartdata.sql.gz" ]; then
        echo "Importing live Grapher chartdata database (owid_chartdata)"
        import_db $DATA_FOLDER/owid_chartdata.sql.gz
    fi
}
fillGrapherDb
