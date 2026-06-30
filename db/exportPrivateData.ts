// Script to export the private sidecar dump WITH data, for staging servers
// and devs with access.
//
// The public metadata dump (owid_metadata.sql.gz, see exportMetadata.ts) ships
// the PRIVATE_DATA_TABLES schema-only because their data is sensitive or
// internal (hashed admin API keys, per-page/per-chart analytics view counts).
// This sidecar dump carries their data and is uploaded to a PRIVATE bucket
// (r2:owid-private) — it must never be published. Staging servers and devs
// with access import it after the public dump via `make refresh.private`
// (see devTools/docker/refresh-private-data.sh).

import parseArgs from "minimist"

import {
    GRAPHER_DB_NAME,
    GRAPHER_DB_USER,
    GRAPHER_DB_PASS,
    GRAPHER_DB_HOST,
    GRAPHER_DB_PORT,
} from "../settings/serverSettings.js"
import { execWrapper } from "./execWrapper.js"
import { PRIVATE_DATA_TABLES } from "./exportMetadataTables.js"

const argv = parseArgs(process.argv.slice(2))
const filePath = argv._[0] || "/tmp/owid_private.sql"

async function dataExport(): Promise<void> {
    console.log(`Exporting private tables to ${filePath}...`)

    // Expose password to mysqldump
    // Safer than passing as an argument because it's not shown in 'ps aux'
    process.env.MYSQL_PWD = GRAPHER_DB_PASS

    await execWrapper(
        `mysqldump --default-character-set=utf8mb4 --no-tablespaces -u '${GRAPHER_DB_USER}' -h '${GRAPHER_DB_HOST}' -P ${GRAPHER_DB_PORT} ${GRAPHER_DB_NAME} ${PRIVATE_DATA_TABLES.join(
            " "
        )} -r ${filePath}`
    )
}

void dataExport()
