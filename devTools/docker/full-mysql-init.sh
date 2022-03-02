#!/usr/bin/env  bash
set -o errexit
set -o pipefail
set -o nounset

source "$( dirname -- "${BASH_SOURCE[0]}" )/create-and-fill-wordpress-db.sh"
createAndFillWordpressDb
source "$( dirname -- "${BASH_SOURCE[0]}" )/create-and-fill-grapher-db.sh"
createAndFillGrapherDb
