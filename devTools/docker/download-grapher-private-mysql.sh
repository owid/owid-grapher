#!/usr/bin/env  bash
set -o errexit
set -o pipefail
set -o nounset

# Downloads the PRIVATE sidecar dump: full data for the PRIVATE_DATA_TABLES
# that the public owid_metadata.sql.gz ships schema-only (see
# db/exportPrivateData.ts).
#
# Access options, in order of preference:
#   - OWID_PRIVATE_DUMP_URL env var (e.g. a presigned URL)
#   - rclone with access to r2:owid-private (staging servers have this)
#
# Without access we skip gracefully — the private tables just stay empty,
# which is the same experience external contributors get.

FOLDER="${DATA_FOLDER:-./tmp-downloads}"

mkdir -p $FOLDER

# Start clean so a run without access can't silently import a stale dump left
# by an earlier run — "no access" must really mean "tables stay empty".
rm -f "$FOLDER/owid_private.sql.gz"

if [[ -n "${OWID_PRIVATE_DUMP_URL:-}" ]]; then
    echo "Downloading private dump (owid_private) from \$OWID_PRIVATE_DUMP_URL"
    curl -fLo $FOLDER/owid_private.sql.gz "$OWID_PRIVATE_DUMP_URL"
elif command -v rclone >/dev/null 2>&1 && rclone lsf r2:owid-private/owid_private.sql.gz >/dev/null 2>&1; then
    echo "Downloading private dump (owid_private) from r2:owid-private"
    rclone copyto r2:owid-private/owid_private.sql.gz $FOLDER/owid_private.sql.gz
else
    echo "No access to the private dump — skipping (private tables stay empty)"
fi
