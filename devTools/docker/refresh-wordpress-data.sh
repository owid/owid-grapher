#!/usr/bin/env  bash
set -o errexit
set -o pipefail
set -o nounset

: "${WORDPRESS_DB_NAME:?Need to set WORDPRESS_DB_NAME non-empty}"
: "${WORDPRESS_DB_USER:?Need to set WORDPRESS_DB_USER non-empty}"
: "${WORDPRESS_DB_PASS:?Need to set WORDPRESS_DB_PASS non-empty}"
: "${DB_ROOT_PASS:?Need to set DB_ROOT_PASS non-empty}"
: "${DB_ROOT_HOST:?Need to set DB_ROOT_HOST non-empty}"
: "${DATA_FOLDER:?Need to set DATA_FOLDER non-empty}"

MYSQL="mysql --default-character-set=utf8mb4"

fillWordpressDb() {
    echo "Importing Wordress database (live_wordpress)"
    $MYSQL -h$DB_ROOT_HOST -uroot -p$DB_ROOT_PASS --port 3306 -e "DROP DATABASE IF EXISTS $WORDPRESS_DB_NAME;CREATE DATABASE $WORDPRESS_DB_NAME; GRANT ALL PRIVILEGES ON $WORDPRESS_DB_NAME.* TO '$WORDPRESS_DB_USER'"
    cat $DATA_FOLDER/live_wordpress.sql.gz  | gunzip | $MYSQL -h$DB_ROOT_HOST --port=3306 -u$WORDPRESS_DB_USER -p$WORDPRESS_DB_PASS $WORDPRESS_DB_NAME
}
fillWordpressDb
