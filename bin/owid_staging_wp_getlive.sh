#!/bin/bash -e

RSYNC="rsync -havz --progress"
LIVE_HOST="owid@owid"
LIVE_DBNAME="live_wordpress"
STAGING_DBNAME="staging_wordpress"

ssh $LIVE_HOST "sudo mysqldump --default-character-set=utf8mb4 ${LIVE_DBNAME} -r ~/${LIVE_DBNAME}.sql"
$RSYNC $LIVE_HOST:$LIVE_DBNAME.sql ~/backup/
$RSYNC --delete --exclude=/wp-config.php --exclude=/wp-snapshots $LIVE_HOST:live-wordpress/ ~/staging-wordpress
sudo mysql -e "DROP DATABASE ${STAGING_DBNAME};"
sudo mysql --default-character-set="utf8mb4" -e "CREATE DATABASE ${STAGING_DBNAME};"
sudo mysql --default-character-set="utf8mb4" -D $STAGING_DBNAME -e "source ~/backup/${LIVE_DBNAME}.sql;"
# echo "UPDATE wp_options SET option_value='http://localhost:8080' WHERE option_name='siteurl';" | mysql -D $STAGING_DBNAME
# echo "UPDATE wp_options SET option_value='http://localhost:8080' WHERE option_name='home';" | mysql -D $STAGING_DBNAME
