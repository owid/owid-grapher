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
  echo "Refreshes content. At the minimum, the Grapher database is cleared and populated after downloading the latest archives."
  echo "The Grapher database is only populated with owid_metadata by default. Add --with-chartdata to have access to the full content."
  echo "Usage: refresh [options...]"
  echo ""
  echo "Options:"
  echo -e "\t-h, --help"
  echo "Set SKIP_DB_DL to true to skip downloading and try to use local files"
  echo "Set WITH_CHARTDATA to true to include downloading data for used charts"
#   echo -e "\t-s, --skip-db-dl\tImports all databases from existing dumps. Run once without option to retrieve them."
#   echo -e "\t-c, --with-chartdata\tDownloads additional Grapher chart data (owid_chartdata)"
}


purge_db(){
  $MYSQL -h $1 -uroot -p$DB_ROOT_PASS --port 3306 -e "DROP DATABASE IF EXISTS $2;CREATE DATABASE $2; GRANT ALL PRIVILEGES ON $2.* TO '$3'"
}

import_db(){
  pv $1 | gunzip | $MYSQL -h $2 --port 3306 -u$4 -p$5 $3
}

fillGrapherDb() {
    # Grapher database (owid_metadata)
    echo "Importing live Grapher metadata database (owid_metadata)"
    purge_db $DB_HOST $DB_NAME $DB_USER
    import_db $DATA_FOLDER/owid_metadata.sql.gz $DB_HOST $DB_NAME $DB_USER $DB_PASS

    echo "Importing live Grapher chartdata database (owid_chartdata)"
    import_db $DATA_FOLDER/owid_chartdata.sql.gz $DB_HOST $DB_NAME $DB_USER $DB_PASS
}
fillGrapherDb
