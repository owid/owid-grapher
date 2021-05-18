#!/bin/bash
#
#  downloadAndCreateDatabase.sh
#
#  Download and ingest the publicly shared subset of the production grapher 
#  database, containing data for every published graph.
#

set -e

DB_NAME=grapher
MYSQL="mysql -h 127.0.0.1 -u root"

# database should not exist for a fresh lando spin-up
$MYSQL -e "CREATE DATABASE IF NOT EXISTS ${DB_NAME};"

curl -Lo /tmp/owid_metadata.sql.gz https://files.ourworldindata.org/owid_metadata.sql.gz
gunzip < /tmp/owid_metadata.sql.gz | $MYSQL -D ${DB_NAME}
curl -Lo /tmp/owid_chartdata.sql.gz https://files.ourworldindata.org/owid_chartdata.sql.gz
gunzip < /tmp/owid_chartdata.sql.gz | $MYSQL -D ${DB_NAME}