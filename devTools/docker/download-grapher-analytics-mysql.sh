#!/usr/bin/env  bash
set -o errexit
set -o pipefail
set -o nounset

# Downloads the PRIVATE analytics dump: full data for the analytics_* tables
# that the public owid_metadata.sql.gz ships schema-only (see
# db/exportAnalyticsData.ts).
#
# Access options, in order of preference:
#   - OWID_ANALYTICS_DUMP_URL env var (e.g. a presigned URL)
#   - rclone with access to r2:owid-private (staging servers have this)
#
# Without access we skip gracefully — the analytics tables just stay empty,
# which is the same experience external contributors get.

FOLDER="${DATA_FOLDER:-./tmp-downloads}"

mkdir -p $FOLDER

if [[ -n "${OWID_ANALYTICS_DUMP_URL:-}" ]]; then
    echo "Downloading private analytics dump (owid_analytics) from \$OWID_ANALYTICS_DUMP_URL"
    curl -fLo $FOLDER/owid_analytics.sql.gz "$OWID_ANALYTICS_DUMP_URL"
elif command -v rclone >/dev/null 2>&1 && rclone lsf r2:owid-private/owid_analytics.sql.gz >/dev/null 2>&1; then
    echo "Downloading private analytics dump (owid_analytics) from r2:owid-private"
    rclone copyto r2:owid-private/owid_analytics.sql.gz $FOLDER/owid_analytics.sql.gz
else
    echo "No access to the private analytics dump — skipping (analytics tables stay empty)"
fi
