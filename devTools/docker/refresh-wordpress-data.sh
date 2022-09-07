#!/usr/bin/env  bash
set -o errexit
set -o pipefail
set -o nounset

: "${WORDPRESS_DB_NAME:?Need to set WORDPRESS_DB_NAME non-empty}"
: "${WORDPRESS_DB_USER:?Need to set WORDPRESS_DB_USER non-empty}"
: "${DB_ROOT_PASS:?Need to set DB_ROOT_PASS non-empty}"
: "${DB_ROOT_HOST:?Need to set DB_ROOT_HOST non-empty}"
: "${DATA_FOLDER:?Need to set DATA_FOLDER non-empty}"

_mysql() {
    mysql --default-character-set=utf8mb4 -h"${DB_ROOT_HOST}" -uroot -p"${DB_ROOT_PASS}" --port 3306 "$@"
}

fillWordpressDb() {
    echo "==> Refreshing wordpress database"
    if [ -f "${DATA_FOLDER}/live_wordpress.sql.gz" ]; then
        echo "Importing Wordress database (live_wordpress)"
        _mysql -e "DROP DATABASE IF EXISTS $WORDPRESS_DB_NAME;CREATE DATABASE $WORDPRESS_DB_NAME;"
        cat $DATA_FOLDER/live_wordpress.sql.gz  | gunzip | _mysql $WORDPRESS_DB_NAME
    else
        echo "live_wordpress.sql.gz missing in ${DATA_FOLDER}. Refresh aborted."
        return 1;
    fi

    source "$( dirname -- "${BASH_SOURCE[0]}" )/create-wordpress-admin-user.sh"
    echo "==> ✅ Wordpress DB refresh complete"
}

fillWordpressDb
