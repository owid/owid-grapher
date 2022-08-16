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


createAndFillWordpressDb() {
    echo "Waiting for DB to be online"
    mysqladmin ping -h "${DB_ROOT_HOST}" -uroot --password="${DB_ROOT_PASS}" --wait=30

    DB_EXISTS=$(mysql -uroot -p"${DB_ROOT_PASS}" -h"${DB_ROOT_HOST}" --batch --skip-column-names -e "SHOW DATABASES LIKE '"${WORDPRESS_DB_NAME}"';" | grep "${WORDPRESS_DB_NAME}" > /dev/null; echo "$?")
    if [ $DB_EXISTS -eq 0 ];then
        echo "A database with the name '$WORDPRESS_DB_NAME' already exists. exiting"
        return 0;
    fi

    echo "Checking if data dump has been downloaded"
    if [ -f "${DATA_FOLDER}/live_wordpress.sql.gz" ]; then
        echo "found live_wordpress.sql.gz"
    else
        echo "could not find live_wordpress.sql.gz - please download it before running this script"
        return 1;
    fi

    echo "Creating user '$WORDPRESS_DB_USER'"
    mysql -uroot -p"${DB_ROOT_PASS}" -h"${DB_ROOT_HOST}" --batch -e "CREATE USER IF NOT EXISTS '$WORDPRESS_DB_USER' IDENTIFIED BY '$WORDPRESS_DB_PASS'; GRANT SELECT ON * . * TO '$WORDPRESS_DB_USER'; FLUSH PRIVILEGES;"

    WITH_UPLOADS=true

    source "$( dirname -- "${BASH_SOURCE[0]}" )/refresh-wordpress-data.sh"

    return 0
}
