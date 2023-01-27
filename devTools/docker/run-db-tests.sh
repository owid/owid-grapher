#!/usr/bin/env  bash
set -o errexit
set -o pipefail
set -o nounset

yarn typeorm migration:run -d itsJustJavascript/db/tests/dataSource.dbtests.js

echo '==> Running tests'
yarn run jest --config=jest.db.config.js
