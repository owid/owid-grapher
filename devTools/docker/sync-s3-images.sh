#!/usr/bin/env  bash

# This script assumes that you have ssh access to the OWID production db server at live-db.owid.io It will
# fail if you don't have these credentials

set -o errexit
set -o pipefail
set -o nounset

s3cmd sync s3://owid-image-upload/production/ s3://$IMAGE_HOSTING_BUCKET_PATH/