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

import * as fs from "fs-extra"
import parseArgs from "minimist"

import {
    GRAPHER_DB_NAME,
    GRAPHER_DB_USER,
    GRAPHER_DB_PASS,
    GRAPHER_DB_HOST,
    GRAPHER_DB_PORT,
} from "../settings/serverSettings.js"
import { knexReadonlyTransaction, knexRaw } from "./db.js"
import { execWrapper } from "./execWrapper.js"
import { PRIVATE_DATA_TABLES } from "./exportMetadataTables.js"

/** Slack member ids look like U01THNNPDCG; anything else is not written out */
const SLACK_ID_PATTERN = /^[A-Z0-9]+$/

/**
 * Puts real Slack ids back, as UPDATE statements appended to the sidecar.
 *
 * `users` can't simply be listed as a private table: it rides in the public dump
 * so that staging and local dev have plausible authorship and a working login,
 * which means every column in it is published. A Slack id identifies a person
 * outside our systems, so it is nulled there (see exportMetadata.ts) and carried
 * here instead - the same two-tier split the private tables get, applied to one
 * column rather than a whole table.
 */
async function slackIdUpdatesSql(): Promise<string> {
    const rows = await knexReadonlyTransaction(async (trx) =>
        knexRaw<{ id: number; slackId: string }>(
            trx,
            `SELECT id, slackId FROM users WHERE slackId IS NOT NULL`
        )
    )
    const statements = rows
        .filter((row) => SLACK_ID_PATTERN.test(row.slackId))
        .map(
            (row) =>
                `UPDATE users SET slackId = '${row.slackId}' WHERE id = ${row.id};`
        )
    if (!statements.length) return ""
    return (
        "\n-- Slack ids, nulled in the public dump (see exportMetadata.ts)\n" +
        statements.join("\n") +
        "\n"
    )
}

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

    // Appended after the dump so the statements run once the tables are in place
    await fs.appendFile(filePath, await slackIdUpdatesSql())
}

void dataExport()
