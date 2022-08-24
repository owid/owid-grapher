#!/usr/bin/env  bash
set -o errexit
set -o pipefail
set -o nounset

: "${WORDPRESS_DB_NAME:?Need to set WORDPRESS_DB_NAME non-empty}"
: "${WORDPRESS_DB_USER:?Need to set WORDPRESS_DB_USER non-empty}"
: "${WORDPRESS_DB_PASS:?Need to set WORDPRESS_DB_PASS non-empty}"
: "${WORDPRESS_DB_HOST:?Need to set WORDPRESS_DB_HOST non-empty}"
: "${WORDPRESS_DB_PORT:?Need to set WORDPRESS_DB_HOST non-empty}"
: "${DATA_FOLDER:?Need to set DATA_FOLDER non-empty}"

_mysql() {
    mysql --default-character-set=utf8mb4 -h"${WORDPRESS_DB_HOST}" -u"${WORDPRESS_DB_USER}" -p"${WORDPRESS_DB_PASS}" --port "${WORDPRESS_DB_PORT}" "$@"
}

fillWordpressDb() {
    if [ -f "${DATA_FOLDER}/live_wordpress.sql.gz" ]; then
        echo "Importing Wordress database (live_wordpress)"
        _mysql -e "DROP DATABASE IF EXISTS $WORDPRESS_DB_NAME;CREATE DATABASE $WORDPRESS_DB_NAME;"
        cat $DATA_FOLDER/live_wordpress.sql.gz  | gunzip | $MYSQL $WORDPRESS_DB_NAME
    else
        echo "live_wordpress.sql.gz missing in ${DATA_FOLDER}. Refresh aborted."
        return 1;
    fi

    source "$( dirname -- "${BASH_SOURCE[0]}" )/create-wordpress-admin-user.sh"
}

fillWordpressDb
