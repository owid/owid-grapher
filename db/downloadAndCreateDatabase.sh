#!/bin/bash
#
#  downloadAndCreateDatabase.sh
#
#  Download and ingest the publicly shared subset of the production grapher
#  database, containing data for every published graph.
#

set -e

function bail() {
    echo "ERROR: $@" 1>&2
    exit 1
}

test -f .env || bail "You must run this from the owid-grapher folder and have a .env file"

# use whatever database settings are in .env
source ../.env

MYSQL="mysql -h ${DB_HOST} -u ${DB_USER} --password='${DB_PASS}'"

# database should not exist for a fresh lando spin-up
$MYSQL -e "CREATE DATABASE IF NOT EXISTS ${DB_NAME};"

curl -Lo /tmp/owid_metadata.sql.gz https://files.ourworldindata.org/owid_metadata.sql.gz
gunzip < /tmp/owid_metadata.sql.gz | $MYSQL -D ${DB_NAME}
curl -Lo /tmp/owid_chartdata.sql.gz https://files.ourworldindata.org/owid_chartdata.sql.gz
gunzip < /tmp/owid_chartdata.sql.gz | $MYSQL -D ${DB_NAME}
