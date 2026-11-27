#!/bin/bash

# This script converts some of the .woff2 fonts in public/fonts to .ttf and
# writes them to public/fonts/ttf. Our Cloudflare Functions fetch them from
# there (via env.ASSETS) to render PNG thumbnails, since resvg can't read woff2.

# Needs woff2_decompress to be available: Run `brew install woff2` to install it on macOS.

# Check whether woff2_decompress is installed
if ! command -v woff2_decompress &> /dev/null; then
    echo "woff2_decompress could not be found. Please install it first (e.g. 'brew install woff2')."
    exit 1
fi

SRC_DIR="$(dirname "$0")/../../public/fonts"
DEST_DIR="$SRC_DIR/ttf"

# resolve these dirs to absolute paths
SRC_DIR="$(realpath "$SRC_DIR")"
DEST_DIR="$(realpath "$DEST_DIR")"

FONTS=(
    "LatoLatin-Regular"
    "LatoLatin-Medium"
    "LatoLatin-Italic"
    "LatoLatin-Bold"
    "PlayfairDisplayLatin-SemiBold"
)

echo "Copying fonts from $SRC_DIR to $DEST_DIR"

for FONT in "${FONTS[@]}"; do
    echo "Copying $FONT.woff2 -> ttf/$FONT.ttf"
    cp "$SRC_DIR/$FONT.woff2" "$DEST_DIR/$FONT.woff2"

    woff2_decompress "$DEST_DIR/$FONT.woff2"

    rm "$DEST_DIR/$FONT.woff2"
done

echo "Done."
