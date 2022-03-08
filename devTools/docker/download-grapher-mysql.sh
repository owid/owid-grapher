#!/usr/bin/env  bash
set -o errexit
set -o pipefail
set -o nounset

FOLDER="${DATA_FOLDER:-./tmp-downloads}"

mkdir -p $FOLDER

echo "Downloading live Grapher metadata database (owid_metadata)"
curl -Lo $FOLDER/owid_metadata.sql.gz https://files.ourworldindata.org/owid_metadata.sql.gz

echo "Downloading live Grapher chartdata database (owid_chartdata)"
curl -Lo $FOLDER/owid_chartdata.sql.gz https://files.ourworldindata.org/owid_chartdata.sql.gz
