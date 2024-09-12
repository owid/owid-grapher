#!/usr/bin/env  bash

set -o errexit
set -o pipefail

if [[ -z "$IMAGE_HOSTING_R2_BUCKET_PATH" ]]; then
  echo 'Please set IMAGE_HOSTING_R2_BUCKET_PATH in .env'
  exit 1
fi

# IMAGE_HOSTING_R2_BUCKET_PATH should be your environment's folder in the owid-image-upload-staging bucket
# e.g. owid-image-upload-staging/branch-name
# for local development, it should be owid-image-upload/my-yourname
# at least until we decide to instead host images locally, if ever
if ! grep -q '[owid-r2]' ~/.config/rclone/rclone.conf; then
  echo 'Please configure your rclone config for profile owid-r2:'
  echo
  echo '  rclone config'
  echo
  exit 1
fi

if rclone lsd owid-r2:owid-image-upload/; then
    PROD_BUCKET="owid-image-upload"
else
    # If access is denied, switch to the staging bucket
    PROD_BUCKET="owid-image-upload-staging"
    echo "Access Denied to owid-image-upload, fetching from owid-image-upload-staging..."
fi

echo "Debug: [$GRAPHER_BRANCH]"
echo "Debug: [$PROD_BUCKET]"
echo "Debug: [$IMAGE_HOSTING_R2_BUCKET_PATH]"

# Log if LF is present in the bucket path
if [[ $IMAGE_HOSTING_R2_BUCKET_PATH == *$'\n'* ]]; then
  echo "LF present in IMAGE_HOSTING_R2_BUCKET_PATH"
fi

# Strip LF from the end of the bucket path
IMAGE_HOSTING_R2_BUCKET_PATH=$(echo $IMAGE_HOSTING_R2_BUCKET_PATH | tr -d '\n')

rclone sync owid-r2:$PROD_BUCKET/production/ owid-r2:$IMAGE_HOSTING_R2_BUCKET_PATH/ --verbose --transfers=32 --checkers=32 --fast-list