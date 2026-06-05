// Script to export the analytics view tables WITH data, for staging servers
// and devs.
//
// The public metadata dump (owid_metadata.sql.gz, see exportMetadata.ts) ships
// these tables schema-only: per-page/per-chart view counts are internal. This
// sidecar dump carries their data and is uploaded to a PRIVATE bucket
// (r2:owid-private) — it must never be published. Staging servers and devs
// with access import it after the public dump via `make refresh.analytics`
// (see devTools/docker/refresh-analytics-data.sh).
//
// The tables are owned and populated on prod by the analytics service
// (`ana bigquery-to-mysql` in owid/analytics). Keep this list in sync with
// the analytics tables in SCHEMA_ONLY_TABLES in exportMetadata.ts.
// (analytics_popularity is also analytics-owned, but it's whitelisted in the
// public dump with data, so it doesn't need to travel here.)

import parseArgs from "minimist"

import {
    GRAPHER_DB_NAME,
    GRAPHER_DB_USER,
    GRAPHER_DB_PASS,
    GRAPHER_DB_HOST,
    GRAPHER_DB_PORT,
} from "../settings/serverSettings.js"
import { execWrapper } from "./execWrapper.js"

const argv = parseArgs(process.argv.slice(2))
const filePath = argv._[0] || "/tmp/owid_analytics.sql"

const analyticsTables = [
    "analytics_chart_views",
    "analytics_grapher_views",
    "analytics_pageviews",
]

async function dataExport(): Promise<void> {
    console.log(`Exporting analytics tables to ${filePath}...`)

    // Expose password to mysqldump
    // Safer than passing as an argument because it's not shown in 'ps aux'
    process.env.MYSQL_PWD = GRAPHER_DB_PASS

    await execWrapper(
        `mysqldump --default-character-set=utf8mb4 --no-tablespaces -u '${GRAPHER_DB_USER}' -h '${GRAPHER_DB_HOST}' -P ${GRAPHER_DB_PORT} ${GRAPHER_DB_NAME} ${analyticsTables.join(
            " "
        )} -r ${filePath}`
    )
}

void dataExport()
