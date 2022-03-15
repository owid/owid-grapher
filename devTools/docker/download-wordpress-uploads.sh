#!/usr/bin/env  bash
set -o errexit
set -o pipefail
set -o nounset

# This script assumes that you have ssh access to the OWID production server called owid-live. It will
# fail if you don't have these credentials

# Wordpress uploads
echo "Downloading Wordress uploads"
rsync -havz --delete --exclude=/.gitkeep --progress owid@live.owid.io:live-data/wordpress/uploads/ ./wordpress/web/app/uploads
