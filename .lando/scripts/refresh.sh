#!/bin/bash -e
# Arguments parsing inspired by https://gist.github.com/jehiah/855086

LANDO_WORDPRESS_DB_HOST=database
LANDO_WORDPRESS_DB_NAME=wordpress
LANDO_GRAPHER_DB_HOST=database-grapher
LANDO_GRAPHER_DB_NAME=grapher

WITH_UPLOADS=false
WITH_CHARTDATA=false
SKIP_DB_DL=false

usage()
{
  echo "Refreshes local content. At the minimum, both Wordress and Grapher databases are cleared and populated after downloading the latest archives."
  echo "The Grapher database is only populated with owid_metadata by default. Add --with-chartdata to have access to the full content."
  echo "Usage:"
  echo -e "\t-h, --help"
  echo -e "\t-s, --skip-db-dl\tImports all databases from existing dumps. Run once without flag to retrieve them."
  echo -e "\t-u, --with-uploads\tDownloads Wordpress uploads"
  echo -e "\t-c, --with-chartdata\tDownloads additional Grapher chart data (owid_chartdata)"
}

purge_db(){
  mysql -uroot -h $1 -e "DROP DATABASE $2;CREATE DATABASE $2"
}

import_db(){
  pv $1 | gunzip | mysql -uroot -h $2 $3
}

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


# Wordpress DB
if [ "${SKIP_DB_DL}" = false ]; then
  echo 'Downloading Wordress database (live_wordpress)'
  ssh owid-live "sudo mysqldump --default-character-set=utf8mb4 live_wordpress -r live_wordpress.sql && gzip -f live_wordpress.sql"
  rsync -havz --progress owid-live:live_wordpress.sql.gz .
fi
echo 'Importing Wordress database (live_wordpress)'
purge_db $LANDO_WORDPRESS_DB_HOST $LANDO_WORDPRESS_DB_NAME
import_db live_wordpress.sql.gz $LANDO_WORDPRESS_DB_HOST $LANDO_WORDPRESS_DB_NAME

# Wordpress uploads
if [ "${WITH_UPLOADS}" = true ]; then
  rsync -havz --delete --exclude=/.gitkeep --progress owid-live:live-wordpress/web/app/uploads/ web/app/uploads
fi


# Grapher database (owid_metadata)
if [ "${SKIP_DB_DL}" = false ]; then
  echo 'Downloading live Grapher metadata database (owid_metadata)'
  curl -LO https://files.ourworldindata.org/owid_metadata.sql.gz
fi
echo 'Importing live Grapher metadata database (owid_metadata)'
purge_db $LANDO_GRAPHER_DB_HOST $LANDO_GRAPHER_DB_NAME
import_db owid_metadata.sql.gz $LANDO_GRAPHER_DB_HOST $LANDO_GRAPHER_DB_NAME

# Grapher database (owid_chartdata)
if [ "${WITH_CHARTDATA}" = true ]; then
  if [ "${SKIP_DB_DL}" = false ]; then
    echo 'Downloading live Grapher chartdata database (owid_chartdata)'
    curl -LO https://files.ourworldindata.org/owid_chartdata.sql.gz
  fi
  echo 'Importing live Grapher chartdata database (owid_chartdata)'
  import_db owid_chartdata.sql.gz $LANDO_GRAPHER_DB_HOST $LANDO_GRAPHER_DB_NAME
fi
