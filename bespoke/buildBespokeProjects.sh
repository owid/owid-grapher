#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/projects"

yarn --immutable
yarn build

OUTPUT_DIR="../../dist/assets-bespoke"
rm -rf "$OUTPUT_DIR"

for dist in */dist; do
    name="${dist%%/*}"
    mkdir -p "$OUTPUT_DIR/$name"
    cp -r "$dist"/* "$OUTPUT_DIR/$name/"

    absolute_dir=$(realpath "$OUTPUT_DIR/$name")
    echo "Built bespoke project: $name, output at $absolute_dir/"
done

echo "done."
