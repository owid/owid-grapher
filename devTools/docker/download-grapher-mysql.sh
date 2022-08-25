#!/usr/bin/env  bash
set -o errexit
set -o pipefail
set -o nounset

source "$( dirname -- "${BASH_SOURCE[0]}" )/download-grapher-metadata-mysql.sh"

source "$( dirname -- "${BASH_SOURCE[0]}" )/download-grapher-chartdata-mysql.sh"
