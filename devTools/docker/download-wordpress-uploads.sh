#!/usr/bin/env  bash
set -o errexit
set -o pipefail
set -o nounset

# Wordpress uploads
echo "Downloading Wordress uploads"
rsync -havz --delete --exclude=/.gitkeep --progress owid-live:live-data/wordpress/uploads/ /app/web/app/uploads