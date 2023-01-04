#!/usr/bin/env  bash
set -o errexit
set -o pipefail
set -o nounset


: "${GRAPHER_TEST_USER:?Need to set GRAPHER_TEST_USER non-empty}"
: "${GRAPHER_TEST_PASS:?Need to set GRAPHER_TEST_PASS non-empty}"
: "${GRAPHER_TEST_NAME:?Need to set GRAPHER_TEST_NAME non-empty}"
: "${DB_ROOT_HOST:?Need to set DB_ROOT_HOST non-empty}"
: "${DB_ROOT_PASS:?Need to set DB_ROOT_PASS non-empty}"

export GRAPHER_DB_HOST=${DB_ROOT_HOST}
export GRAPHER_DB_PORT=3306

_mysql() {
    mysql -uroot -p$DB_ROOT_PASS -h$DB_ROOT_HOST --batch --skip-column-names "$@"
}

createTestDb() {
    echo "Waiting for DB to be online"
    mysqladmin ping -h$DB_ROOT_HOST -uroot --password=$DB_ROOT_PASS --wait=30

    DB_EXISTS=$(_mysql -e "SHOW DATABASES LIKE '"${GRAPHER_TEST_NAME}"';" | grep "${GRAPHER_TEST_NAME}" > /dev/null; echo "$?")
    if [ $DB_EXISTS -neq 0 ];then
        _mysql -e "CREATE DATABASE IF NOT EXISTS '$GRAPHER_TEST_NAME';"
    fi

    _mysql -e "CREATE USER IF NOT EXISTS '$GRAPHER_TEST_USER' IDENTIFIED BY '$GRAPHER_TEST_PASS'; GRANT ALL PRIVILEGES ON * . * TO '$GRAPHER_TEST_USER'; FLUSH PRIVILEGES;"
    return 0
}

createTestDb
