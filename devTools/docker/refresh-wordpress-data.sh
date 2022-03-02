#!/usr/bin/env  bash
set -o errexit
set -o pipefail
set -o nounset

: "${DB_NAME:?Need to set DB_NAME non-empty}"
: "${DB_USER:?Need to set DB_USER non-empty}"
: "${DB_HOST:?Need to set DB_HOST non-empty}"
: "${DB_PASS:?Need to set DB_PASS non-empty}"
: "${DB_ROOT_PASS:?Need to set DB_ROOT_PASS non-empty}"
: "${DATA_FOLDER:?Need to set DATA_FOLDER non-empty}"

MYSQL="mysql --default-character-set=utf8mb4"

usage()
{
  echo "Refreshes content. At the minimum, the Wordress database is cleared and populated after downloading the latest archives."
  echo "Usage: refresh [options...]"
  echo ""
  echo "Options:"
  echo -e "\t-h, --help"
  echo "Set SKIP_DB_DL to true to skip downloading and try to use local files"
}



purge_db(){
  $MYSQL -h $1 -uroot -p$DB_ROOT_PASS --port 3306 -e "DROP DATABASE IF EXISTS $2;CREATE DATABASE $2; GRANT ALL PRIVILEGES ON $2.* TO '$3'"
}

import_db(){
  pv $1 | gunzip | $MYSQL -h $2 --port 3306 -u$4 -p$5 $3
}

fillWordpressDb() {
    # Wordpress DB
    echo "Importing Wordress database (live_wordpress)"
    purge_db $DB_HOST $DB_NAME $DB_USER
    import_db $DATA_FOLDER/live_wordpress.sql.gz $DB_HOST $DB_NAME $DB_USER $DB_PASS
}
fillWordpressDb
