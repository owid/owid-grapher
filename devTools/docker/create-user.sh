#!/usr/bin/env  bash
set -o errexit
set -o pipefail
set -o nounset


: "${DB_NAME:?Need to set DB_NAME non-empty}"
: "${DB_USER:?Need to set DB_USER non-empty}"
: "${DB_HOST:?Need to set DB_HOST non-empty}"
: "${DB_PASS:?Need to set DB_PASS non-empty}"
: "${DB_ROOT_PASS:?Need to set DB_ROOT_PASS non-empty}"

echo "Creating user"
mysql -uroot -p"${DB_ROOT_PASS}" -h"${DB_HOST}" --batch -e "CREATE USER IF NOT EXISTS '${DB_USER}' IDENTIFIED BY '${DB_PASS}'; GRANT SELECT ON * . * TO '${DB_USER}'; FLUSH PRIVILEGES;"
echo "Database '${DB_NAME}' created"
