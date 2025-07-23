#!/usr/bin/env  bash
set -o errexit
set -o pipefail
set -o nounset


: "${GRAPHER_TEST_DB_USER:?Need to set GRAPHER_TEST_DB_USER non-empty}"
: "${GRAPHER_TEST_DB_PASS:?Need to set GRAPHER_TEST_DB_PASS non-empty}"
: "${GRAPHER_TEST_DB_NAME:?Need to set GRAPHER_TEST_DB_NAME non-empty}"
: "${DB_ROOT_HOST:?Need to set DB_ROOT_HOST non-empty}"
: "${DB_ROOT_PASS:?Need to set DB_ROOT_PASS non-empty}"

export GRAPHER_DB_HOST=${DB_ROOT_HOST}
export GRAPHER_DB_PORT=3306

_mysql() {
    mysql -uroot -p$DB_ROOT_PASS -h$DB_ROOT_HOST --batch --skip-column-names "$@"
}

createTestDb() {
    mysqladmin ping -h$DB_ROOT_HOST -uroot --password=$DB_ROOT_PASS --wait=30 >/dev/null 2>&1

    _mysql --database="" -e "DROP DATABASE IF EXISTS $GRAPHER_TEST_DB_NAME;" >/dev/null 2>&1

    _mysql --database="" -e "CREATE DATABASE $GRAPHER_TEST_DB_NAME;" >/dev/null 2>&1

    _mysql --database="" -e "CREATE USER IF NOT EXISTS '$GRAPHER_TEST_DB_USER' IDENTIFIED BY '$GRAPHER_TEST_DB_PASS'; GRANT ALL PRIVILEGES ON * . * TO '$GRAPHER_TEST_DB_USER'; FLUSH PRIVILEGES;" >/dev/null 2>&1

    cat /migration/pre-migrations-schema.sql | _mysql $GRAPHER_TEST_DB_NAME >/dev/null 2>&1

    _mysql -e "CREATE TABLE _test_db_ready (id INT NOT NULL AUTO_INCREMENT, PRIMARY KEY (id));" $GRAPHER_TEST_DB_NAME >/dev/null 2>&1

    return 0
}

createTestDb
