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
    echo "Waiting for DB to be online"
    mysqladmin ping -h$DB_ROOT_HOST -uroot --password=$DB_ROOT_PASS --wait=30

    _mysql -e "DROP DATABASE IF EXISTS $GRAPHER_TEST_DB_NAME;"

    echo "executing: CREATE DATABASE $GRAPHER_TEST_DB_NAME;"
    _mysql -e "CREATE DATABASE $GRAPHER_TEST_DB_NAME;"

    echo "creating user if it doesn't exist"
    _mysql -e "CREATE USER IF NOT EXISTS '$GRAPHER_TEST_DB_USER' IDENTIFIED BY '$GRAPHER_TEST_DB_PASS'; GRANT ALL PRIVILEGES ON * . * TO '$GRAPHER_TEST_DB_USER'; FLUSH PRIVILEGES;"

    echo "Ingesting sql creation script"
    cat /migration/pre-migrations-schema.sql | _mysql $GRAPHER_TEST_DB_NAME

    echo "Indicating we are done"
    _mysql -e "CREATE TABLE _test_db_ready (id INT NOT NULL AUTO_INCREMENT, PRIMARY KEY (id));" $GRAPHER_TEST_DB_NAME

    echo "done"
    return 0
}

createTestDb
