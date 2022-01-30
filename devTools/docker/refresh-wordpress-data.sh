#!/usr/bin/env  bash
set -o errexit
set -o pipefail
set -o nounset

: "${DB_NAME:?Need to set DB_NAME non-empty}"
: "${DB_USER:?Need to set DB_USER non-empty}"
: "${DB_HOST:?Need to set DB_HOST non-empty}"
: "${DB_PASS:?Need to set DB_PASS non-empty}"
: "${DB_ROOT_PASS:?Need to set DB_ROOT_PASS non-empty}"

MYSQL="mysql --default-character-set=utf8mb4"
DL_FOLDER="."

# Default options
WITH_UPLOADS=false
SKIP_DB_DL=false

usage()
{
  echo "Refreshes content. At the minimum, the Wordress database is cleared and populated after downloading the latest archives."
  echo "Usage: refresh [options...]"
  echo ""
  echo "Options:"
  echo -e "\t-h, --help"
  echo -e "\t-s, --skip-db-dl\tImports all databases from existing dumps. Run once without option to retrieve them."
  echo -e "\t-u, --with-uploads\tDownloads Wordpress uploads"
}

# Arguments parsing inspired by https://gist.github.com/jehiah/855086
while [ "$1" != "" ]; do
  PARAM=`echo $1 | awk -F= '{print $1}'`
  # VALUE=`echo $1 | awk -F= '{print $2}'`
  case $PARAM in
    -h | --help)
      usage
      exit
      ;;
    -s | --skip-db-dl)
      SKIP_DB_DL=true
      ;;
    -u | --with-uploads)
      WITH_UPLOADS=true
      ;;
    *)
      echo "ERROR: unknown parameter \"$PARAM\""
      usage
      exit 1
      ;;
    esac
    shift
done


purge_db(){
  $MYSQL -h $1 -uroot -p$DB_ROOT_PASS --port 3306 -e "DROP DATABASE IF EXISTS $2;CREATE DATABASE $2; GRANT ALL PRIVILEGES ON $2.* TO '$3'"
}

import_db(){
  pv $1 | gunzip | $MYSQL -h $2 --port 3306 -u$4 -p$5 $3
}

# Wordpress DB
if [ "${SKIP_DB_DL}" = false ]; then
  echo "Downloading Wordress database (live_wordpress)"
    ssh owid-live "sudo mysqldump --default-character-set=utf8mb4 live_wordpress -r /tmp/live_wordpress.sql && sudo gzip -f /tmp/live_wordpress.sql"
    rsync -hav --progress owid-live:/tmp/live_wordpress.sql.gz $DL_FOLDER
fi
echo "Importing Wordress database (live_wordpress)"
purge_db $DB_HOST $DB_NAME $DB_USER
import_db $DL_FOLDER/live_wordpress.sql.gz $DB_HOST $DB_NAME $DB_USER $DB_PASS

# Wordpress uploads
if [ "${WITH_UPLOADS}" = true ]; then
  echo "Downloading Wordress uploads"
  rsync -havz --delete --exclude=/.gitkeep --progress owid-live:live-data/wordpress/uploads/ web/app/uploads
fi