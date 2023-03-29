#!/bin/bash

# Sync directory to S3 bucket and gzip all files on the fly

# Abort if any command fails
set -e

# Print each command before executing it
# This line can be commented out or removed for production use
set -x

# Check if two arguments are provided
if [ "$#" -ne 2 ]; then
    echo "Usage: s3sync.sh SOURCE_DIRECTORY S3_BUCKET"
    exit 1
fi

# Set variables for source directory and S3 bucket
src_dir="$1"
dest_bucket="$2"

# Create temporary directory
temp_dir="${src_dir}-gzip"
cp -R "$src_dir/" "$temp_dir/"

# Gzip all files in the directory without .gz extension
find "$temp_dir" -type f -exec gzip --rsyncable -k "{}" \; -exec mv "{}.gz" "{}" \;

# Sync to S3
aws --endpoint=https://nyc3.digitaloceanspaces.com s3 sync "$temp_dir" "$dest_bucket" --acl public-read --content-encoding gzip

# Remove temporary directory
rm -Rf "$temp_dir"
