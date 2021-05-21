#!/bin/bash -e

##################################################
# Refresh dev from live content (run from Lando) #
##################################################

# env variables are set by lando's env_file directive
WORDPRESS_DB_HOST=$DB_HOST
WORDPRESS_DB_NAME=$DB_NAME
GRAPHER_DB_HOST=database-grapher
GRAPHER_DB_NAME=grapher
MYSQL="mysql -u root --default-character-set=utf8mb4"
DL_FOLDER="."

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
  pv $1 | gunzip | $MYSQL -h $2 $3
}

# Wordpress DB
if [ "${SKIP_DB_DL}" = false ]; then
  echo "Downloading Wordress database (live_wordpress)"
    ssh owid-live "sudo mysqldump --default-character-set=utf8mb4 live_wordpress -r /tmp/live_wordpress.sql && sudo gzip -f /tmp/live_wordpress.sql"
    rsync -hav --progress owid-live:/tmp/live_wordpress.sql.gz $DL_FOLDER
fi
echo "Importing Wordress database (live_wordpress)"
purge_db $WORDPRESS_DB_HOST $WORDPRESS_DB_NAME
import_db $DL_FOLDER/live_wordpress.sql.gz $WORDPRESS_DB_HOST $WORDPRESS_DB_NAME

# Wordpress uploads
if [ "${WITH_UPLOADS}" = true ]; then
  echo "Downloading Wordress uploads"
  rsync -havz --delete --exclude=/.gitkeep --progress owid-live:live-data/wordpress/uploads/ web/app/uploads
fi

# Grapher database (owid_metadata)
if [ "${SKIP_DB_DL}" = false ]; then
  echo "Downloading live Grapher metadata database (owid_metadata)"
  curl -Lo $DL_FOLDER/owid_metadata.sql.gz https://files.ourworldindata.org/owid_metadata.sql.gz
fi
echo "Importing live Grapher metadata database (owid_metadata)"
purge_db $GRAPHER_DB_HOST $GRAPHER_DB_NAME
import_db $DL_FOLDER/owid_metadata.sql.gz $GRAPHER_DB_HOST $GRAPHER_DB_NAME

# Grapher database (owid_chartdata)
if [ "${WITH_CHARTDATA}" = true ]; then
  if [ "${SKIP_DB_DL}" = false ]; then
    echo "Downloading live Grapher chartdata database (owid_chartdata)"
    curl -Lo $DL_FOLDER/owid_chartdata.sql.gz https://files.ourworldindata.org/owid_chartdata.sql.gz
  fi
  echo "Importing live Grapher chartdata database (owid_chartdata)"
  import_db $DL_FOLDER/owid_chartdata.sql.gz $GRAPHER_DB_HOST $GRAPHER_DB_NAME
fi
