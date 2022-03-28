#!/bin/bash -e

################################################################
# Refresh staging targets from live content (run from staging) #
################################################################

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && cd .. && pwd )"

bail() {
    echo "ERROR: $1" 1>&2
    exit 1
}

if [ ! -f $DIR/.env ]; then
  bail "You must configure a .env file for your staging setup"
fi

set -a && source $DIR/.env && set +a

if [ "${WP_ENV}" != "staging" ]; then
  bail "Please only run on staging."
fi

STAGING_SERVER_NAME=$(basename $DIR | cut -d '-' -f1)

check_env() {
  eval value='$'$1
  if [[ ! $value ]]; then bail "\$$1 is unset"; fi
}

wp_mysql() {
  mysql -u${DB_USER} -p"${DB_PASSWORD}" -h $DB_HOST --default-character-set=utf8mb4 "$@" 2>/dev/null
}

gr_mysql() {
  mysql -u${GRAPHER_DB_USER} -p"${GRAPHER_DB_PASSWORD}" -h $GRAPHER_DB_HOST --default-character-set=utf8mb4 "$@" 2>/dev/null
}

DL_FOLDER="/tmp"

# Default options
WITH_UPLOADS=false
WITH_CHARTDATA=false
SKIP_DB_DL=false

usage()
{
  echo "Refreshes content. At the minimum, both Wordress and Grapher databases are cleared and populated after downloading the latest archives."
  echo "The Grapher database is only populated with owid_metadata by default. Add --with-chartdata to have access to the full content."
  echo "Usage: refresh [options...]"
  echo ""
  echo "Options:"
  echo -e "\t-h, --help"
  echo -e "\t-s, --skip-db-dl\tImports all databases from existing dumps. Run once without option to retrieve them."
  echo -e "\t-u, --with-uploads\tDownloads Wordpress uploads"
  echo -e "\t-c, --with-chartdata\tDownloads additional Grapher chart data (owid_chartdata)"
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
    -c | --with-chartdata)
      WITH_CHARTDATA=true
      ;;
    *)
      echo "ERROR: unknown parameter \"$PARAM\""
      usage
      exit 1
      ;;
    esac
    shift
done

purge_wordpress_db(){
  wp_mysql -e "DROP DATABASE $DB_NAME;CREATE DATABASE $DB_NAME"
}

purge_grapher_db(){
  gr_mysql -e "DROP DATABASE $GRAPHER_DB_NAME;CREATE DATABASE $GRAPHER_DB_NAME"
}

import_wordpress_db(){
  pv $1 | wp_mysql $DB_NAME
}

import_grapher_db(){
  pv $1 | gr_mysql $GRAPHER_DB_NAME
}

# Wordpress DB
if [ "${SKIP_DB_DL}" = false ]; then
  echo "Downloading Wordpress database (live_wordpress)"
  ssh owid@live-db.owid.io "sudo mysqldump --default-character-set=utf8mb4 live_wordpress -r /tmp/live_wordpress.sql"
  rsync -hav --progress owid@live-db.owid.io:/tmp/live_wordpress.sql $DL_FOLDER
fi
echo "Importing Wordpress database (live_wordpress)"
check_env DB_NAME
check_env DB_HOST
check_env DB_USER
check_env DB_PASSWORD
purge_wordpress_db
import_wordpress_db $DL_FOLDER/live_wordpress.sql 

# Wordpress uploads
if [ "${WITH_UPLOADS}" = true ]; then
  echo "Downloading Wordpress uploads"
  rsync -hav --delete --progress owid@live-db.owid.io:live-data/wordpress/uploads/ ~/$STAGING_SERVER_NAME-data/wordpress/uploads
fi

# Grapher database (owid_metadata)
if [ "${SKIP_DB_DL}" = false ]; then
  echo "Downloading live Grapher metadata database (owid_metadata)"
  ssh owid@live.owid.io "cd live/itsJustJavascript && node db/exportMetadata.js --with-passwords /tmp/owid_metadata_with_passwords.sql"
  rsync -hav --progress owid@live.owid.io:/tmp/owid_metadata_with_passwords.sql $DL_FOLDER
fi
echo "Importing live Grapher metadata database (owid_metadata)"
check_env GRAPHER_DB_NAME
check_env GRAPHER_DB_HOST
check_env GRAPHER_DB_USER
check_env GRAPHER_DB_PASSWORD
purge_grapher_db
import_grapher_db $DL_FOLDER/owid_metadata_with_passwords.sql

# Grapher database (owid_chartdata)
if [ "${WITH_CHARTDATA}" = true ]; then
  if [ "${SKIP_DB_DL}" = false ]; then
    echo "Downloading live Grapher chartdata database (owid_chartdata)"
    curl -Lo $DL_FOLDER/owid_chartdata.sql.gz https://files.ourworldindata.org/owid_chartdata.sql.gz
    gunzip -f $DL_FOLDER/owid_chartdata.sql.gz
  fi
  echo "Importing live Grapher chartdata database (owid_chartdata)"
  import_grapher_db $DL_FOLDER/owid_chartdata.sql
fi
