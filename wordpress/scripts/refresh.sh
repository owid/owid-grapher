#!/bin/bash -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && cd .. && pwd )"

set -a && source $DIR/.env && set +a

if [ "${WP_ENV}" != "staging" ]; then
  echo "Please only run on staging."
  exit 1
fi

WORDPRESS_DB_HOST=$DB_HOST
WORDPRESS_DB_NAME=$DB_NAME
GRAPHER_DB_HOST=$GRAPHER_DB_HOST
GRAPHER_DB_NAME=$GRAPHER_DB_NAME
STAGING_SERVER_NAME=$(basename $DIR | cut -d '-' -f1)
MYSQL="sudo mysql --default-character-set=utf8mb4"
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

purge_db(){
  $MYSQL -h $1 -e "DROP DATABASE $2;CREATE DATABASE $2"
}

import_db(){
  pv $1 | $MYSQL -h $2 $3
}

# Wordpress DB
if [ "${SKIP_DB_DL}" = false ]; then
  echo "Downloading Wordress database (live_wordpress)"
  ssh owid-live "sudo mysqldump --default-character-set=utf8mb4 live_wordpress -r /tmp/live_wordpress.sql"
  rsync -hav --progress owid-live:/tmp/live_wordpress.sql $DL_FOLDER
fi
echo "Importing Wordress database (live_wordpress)"
purge_db $WORDPRESS_DB_HOST $WORDPRESS_DB_NAME
import_db $DL_FOLDER/live_wordpress.sql $WORDPRESS_DB_HOST $WORDPRESS_DB_NAME

# Wordpress uploads
if [ "${WITH_UPLOADS}" = true ]; then
  echo "Downloading Wordress uploads"
  rsync -hav --delete --progress owid-live:live-data/wordpress/uploads/ ~/$STAGING_SERVER_NAME-data/wordpress/uploads
fi

# Grapher database (owid_metadata)
if [ "${SKIP_DB_DL}" = false ]; then
  echo "Downloading live Grapher metadata database (owid_metadata)"
  ssh owid-live "cd live && yarn tsn scripts/exportMetadata.ts --with-passwords /tmp/owid_metadata_with_passwords.sql"
  rsync -hav --progress owid-live:/tmp/owid_metadata_with_passwords.sql $DL_FOLDER
fi
echo "Importing live Grapher metadata database (owid_metadata)"
purge_db $GRAPHER_DB_HOST $GRAPHER_DB_NAME
import_db $DL_FOLDER/owid_metadata_with_passwords.sql $GRAPHER_DB_HOST $GRAPHER_DB_NAME

# Grapher database (owid_chartdata)
if [ "${WITH_CHARTDATA}" = true ]; then
  if [ "${SKIP_DB_DL}" = false ]; then
    echo "Downloading live Grapher chartdata database (owid_chartdata)"
    curl -Lo $DL_FOLDER/owid_chartdata.sql.gz https://files.ourworldindata.org/owid_chartdata.sql.gz
    gunzip -f $DL_FOLDER/owid_chartdata.sql.gz
  fi
  echo "Importing live Grapher chartdata database (owid_chartdata)"
  import_db $DL_FOLDER/owid_chartdata.sql $GRAPHER_DB_HOST $GRAPHER_DB_NAME
fi
