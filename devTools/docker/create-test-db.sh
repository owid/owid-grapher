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

    DB_EXISTS=$(_mysql -e "SHOW DATABASES LIKE '"${GRAPHER_TEST_DB_NAME}"';" | grep "${GRAPHER_TEST_DB_NAME}" > /dev/null; echo "$?")

    if [ $DB_EXISTS -eq 0 ]
    then
        echo "A database with the name '$GRAPHER_TEST_DB_NAME' already exists."
    else
        echo "A database with the name '$GRAPHER_TEST_DB_NAME' does not exist, creating..."
    fi

    echo "executing: CREATE DATABASE IF NOT EXISTS $GRAPHER_TEST_DB_NAME;"
    _mysql -e "CREATE DATABASE IF NOT EXISTS $GRAPHER_TEST_DB_NAME;"

    echo "creating user if it doesn't exist"
    _mysql -e "CREATE USER IF NOT EXISTS '$GRAPHER_TEST_DB_USER' IDENTIFIED BY '$GRAPHER_TEST_DB_PASS'; GRANT ALL PRIVILEGES ON * . * TO '$GRAPHER_TEST_DB_USER'; FLUSH PRIVILEGES;"


    if [ $DB_EXISTS -eq 0 ]
    then
        echo "..."
    else
        echo "Ingesting sql creation script"
        cat /migration/pre-migrations-schema.sql | _mysql $GRAPHER_TEST_DB_NAME
    fi



    echo "done"
    return 0
}

createTestDb
