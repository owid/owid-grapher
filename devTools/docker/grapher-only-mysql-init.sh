#!/usr/bin/env  bash
set -o errexit
set -o pipefail
set -o nounset

source "$( dirname -- "${BASH_SOURCE[0]}" )/download-grapher-metadata-mysql.sh"
source "$( dirname -- "${BASH_SOURCE[0]}" )/create-and-fill-grapher-db.sh"
createAndFillGrapherDb
echo "✅ All done, grapher DB is loaded ✅"
