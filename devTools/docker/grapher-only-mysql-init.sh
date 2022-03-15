#!/usr/bin/env  bash
set -o errexit
set -o pipefail
set -o nounset

source "$( dirname -- "${BASH_SOURCE[0]}" )/download-grapher-mysql.sh"
source "$( dirname -- "${BASH_SOURCE[0]}" )/create-and-fill-grapher-db.sh"
createAndFillGrapherDb
echo "✅ All done, grapher and wordpress DBs are loaded ✅"
