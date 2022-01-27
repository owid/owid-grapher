#!/usr/bin/env  bash
set -o errexit
set -o pipefail
set -o nounset

# Run the init-dev-db.sql script inside the mysql container as root to create the two users
docker exec -i owid-grapher_db_1 sh -c 'exec mysql -uroot -p"weeniest-stretch-contaminate-gnarl"' < init-dev-db.sql