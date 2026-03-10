#!/bin/bash
#
#  backpopulateWikipediaArchive.sh
#
#  One-off migration: back-populate the Wikipedia archive R2 bucket from the
#  main archive R2 bucket. Needed because the Wikipedia archive was introduced
#  after the main archive had already accumulated data.
#
#  Run directly on the production server (as the owid user):
#
#    cd ~/owid-grapher
#    ./devTools/backpopulateWikipediaArchive.sh
#
#  Steps:
#  1. Server-side copy non-HTML/non-MJS files (fast, R2→R2)
#  2. Download HTML, MJS, and source map files for processing
#  3. Rewrite legacy detect-country.owid.io URLs in MJS bundles and source maps (sed)
#  4. Strip GTM and rewrite archive URLs in HTML via createWikipediaArchive.ts
#  5. Upload processed files to owid-wikipedia-archive
#  6. Clean up local temp directories
#

set -o errexit
set -o pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
GRAPHER_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

TEMP_INPUT_DIR=/home/owid/wikipedia-tmp/backpopulate-input
TEMP_OUTPUT_DIR=/home/owid/wikipedia-tmp/backpopulate-output

# Load archive env vars (ARCHIVE_BASE_URL, WIKIPEDIA_ARCHIVE_BASE_URL, etc.)
PRIMARY_ENV_FILE=.env.archive

server_side_copy_assets() {
    echo "--- Step 1: Server-side copying non-HTML/non-MJS files from owid-archive to owid-wikipedia-archive..."
    rclone copy r2:owid-archive r2:owid-wikipedia-archive \
        --exclude '*.html' --exclude '*.mjs' --exclude '*.mjs.map' \
        --checkers=64 --transfers=64 \
        --retries=5 --retries-sleep=10s \
        --stats 30s
}

download_files() {
    echo "--- Step 2: Downloading HTML, MJS, and source map files from owid-archive..."
    rm -rf "$TEMP_INPUT_DIR"
    mkdir -p "$TEMP_INPUT_DIR"
    rclone copy r2:owid-archive "$TEMP_INPUT_DIR" \
        --include '*.html' --include '*.mjs' --include '*.mjs.map' \
        --checkers=64 --transfers=64 \
        --retries=5 --retries-sleep=10s \
        --stats 30s
}

rewrite_detect_country_urls_in_bundles() {
    echo "--- Step 3: Rewriting legacy detect-country.owid.io URLs in MJS bundles and source maps..."
    find "$TEMP_INPUT_DIR" \( -name '*.mjs' -o -name '*.mjs.map' \) -print0 \
        | xargs -0 sed -i 's|https://detect-country\.owid\.io|https://ourworldindata.org/api/detect-country|g'
}

process_html() {
    echo "--- Step 4: Processing HTML (stripping GTM, rewriting archive URLs)..."
    rm -rf "$TEMP_OUTPUT_DIR"
    mkdir -p "$TEMP_OUTPUT_DIR"
    cd "$GRAPHER_DIR"
    PRIMARY_ENV_FILE=$PRIMARY_ENV_FILE \
        yarn tsx --tsconfig tsconfig.tsx.json ./baker/archival/createWikipediaArchive.ts \
            --inputDir "$TEMP_INPUT_DIR" \
            --outputDir "$TEMP_OUTPUT_DIR"
}

upload_processed_files() {
    echo "--- Step 5: Uploading processed files to owid-wikipedia-archive..."
    rclone copy "$TEMP_OUTPUT_DIR" r2:owid-wikipedia-archive \
        --checkers=64 --transfers=64 \
        --retries=5 --retries-sleep=10s \
        --stats 30s
}

cleanup() {
    echo "--- Cleaning up temporary directories..."
    rm -rf "$TEMP_INPUT_DIR" "$TEMP_OUTPUT_DIR"
}

main() {
    echo "--- Back-populating Wikipedia archive from main archive"
    trap cleanup EXIT

    server_side_copy_assets
    download_files
    rewrite_detect_country_urls_in_bundles
    process_html
    upload_processed_files

    echo "--- Wikipedia archive back-population complete ✅"
}

main
