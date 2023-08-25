#!/usr/bin/env  bash
set -o errexit
set -o pipefail
set -o nounset


: "${GRAPHER_DB_USER:?Need to set GRAPHER_DB_USER non-empty}"
: "${GRAPHER_DB_PASS:?Need to set GRAPHER_DB_PASS non-empty}"
: "${GRAPHER_DB_NAME:?Need to set GRAPHER_DB_NAME non-empty}"
: "${DB_ROOT_HOST:?Need to set DB_ROOT_HOST non-empty}"
: "${DB_ROOT_PASS:?Need to set DB_ROOT_PASS non-empty}"
: "${DATA_FOLDER:?Need to set DATA_FOLDER non-empty}"

export GRAPHER_DB_HOST=${DB_ROOT_HOST}
export GRAPHER_DB_PORT=3306

_mysql() {
    mysql -uroot -p$DB_ROOT_PASS -h$DB_ROOT_HOST --batch --skip-column-names "$@"
}

createAndFillGrapherDb() {
    echo "Waiting for DB to be online"
    mysqladmin ping -h$DB_ROOT_HOST -uroot --password=$DB_ROOT_PASS --wait=30

    DB_EXISTS=$(_mysql -e "SHOW DATABASES LIKE '"${GRAPHER_DB_NAME}"';" | grep "${GRAPHER_DB_NAME}" > /dev/null; echo "$?")

    if [ $DB_EXISTS -eq 0 ];then
        echo "A database with the name '$GRAPHER_DB_NAME' already exists. exiting"
        return 0;
    fi

    echo "Checking if data dump has been downloaded"
    if [ -f "${DATA_FOLDER}/owid_metadata.sql.gz" ];then
        echo "found owid_metadata.sql.gz"
    else
        echo "could not find owid_metadata.sql.gz - please download it before running this script"
        return 1;
    fi

    echo "Creating user '$GRAPHER_DB_USER'"
    _mysql -e "CREATE USER IF NOT EXISTS '$GRAPHER_DB_USER' IDENTIFIED BY '$GRAPHER_DB_PASS'; GRANT ALL PRIVILEGES ON * . * TO '$GRAPHER_DB_USER'; FLUSH PRIVILEGES;"

    source "$( dirname -- "${BASH_SOURCE[0]}" )/refresh-grapher-data.sh"
    return 0
}
