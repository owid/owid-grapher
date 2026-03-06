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
#  1. Server-side copy all non-HTML files (fast, R2→R2)
#  2. Download all HTML files
#  3. Strip GTM and rewrite URLs via createWikipediaArchive.ts
#  4. Upload processed HTML to owid-wikipedia-archive
#  5. Clean up local temp directories
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
    echo "--- Step 1: Server-side copying non-HTML files from owid-archive to owid-wikipedia-archive..."
    rclone copy r2:owid-archive r2:owid-wikipedia-archive \
        --exclude '*.html' \
        --checkers=64 --transfers=64 \
        --stats 30s
}

download_html() {
    echo "--- Step 2: Downloading all HTML from owid-archive..."
    rm -rf "$TEMP_INPUT_DIR"
    mkdir -p "$TEMP_INPUT_DIR"
    rclone copy r2:owid-archive "$TEMP_INPUT_DIR" \
        --include '*.html' \
        --checkers=64 --transfers=64 \
        --stats 30s
}

process_html() {
    echo "--- Step 3: Processing HTML (stripping GTM, rewriting URLs)..."
    rm -rf "$TEMP_OUTPUT_DIR"
    mkdir -p "$TEMP_OUTPUT_DIR"
    cd "$GRAPHER_DIR"
    PRIMARY_ENV_FILE=$PRIMARY_ENV_FILE \
        yarn tsx --tsconfig tsconfig.tsx.json ./baker/archival/createWikipediaArchive.ts \
            --inputDir "$TEMP_INPUT_DIR" \
            --outputDir "$TEMP_OUTPUT_DIR"
}

upload_processed_html() {
    echo "--- Step 4: Uploading processed HTML to owid-wikipedia-archive..."
    rclone copy "$TEMP_OUTPUT_DIR" r2:owid-wikipedia-archive \
        --checkers=64 --transfers=64 \
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
    download_html
    process_html
    upload_processed_html

    echo "--- Wikipedia archive back-population complete ✅"
}

main
