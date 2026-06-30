// Script to export the public metadata database.
//
// The output (published as owid_metadata.sql.gz) is downloaded by anyone who
// runs the Grapher stack locally, so it shouldn't contain anything sensitive.
//
// By default, only each table's structure is exported, with no rows.
// For data to be exported, it must be explicitly included in the
// INCLUDE_DATA_TABLES list in exportMetadataTables.ts.
//
// As a backstop, the script fails if it encounters a table that isn't
// classified in any of those lists, forcing whoever added it to make a
// conscious include/exclude decision. The db test suite runs the same check
// against a freshly migrated database, so an unclassified table already
// fails in CI when its migration is added (see db/tests/exportMetadata.test.ts).

import * as db from "./db.js"
import fs from "fs-extra"
import parseArgs from "minimist"

import {
    GRAPHER_DB_NAME,
    GRAPHER_DB_USER,
    GRAPHER_DB_PASS,
    GRAPHER_DB_HOST,
    GRAPHER_DB_PORT,
} from "../settings/serverSettings.js"
import { execWrapper } from "./execWrapper.js"
import {
    INCLUDE_DATA_TABLES,
    SCHEMA_ONLY_TABLES,
    findUnclassifiedTables,
    unclassifiedTablesErrorMessage,
} from "./exportMetadataTables.js"

const argv = parseArgs(process.argv.slice(2))
const filePath = argv._[0] || "/tmp/owid_metadata.sql"

async function assertAllTablesClassified(): Promise<void> {
    const knex = db.knexInstance()
    const rows = await db.knexRaw<{ TABLE_NAME: string }>(
        knex,
        `SELECT TABLE_NAME FROM information_schema.TABLES
         WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'`,
        [GRAPHER_DB_NAME]
    )
    const allTables = rows.map((r) => r.TABLE_NAME)

    const unclassified = findUnclassifiedTables(allTables)
    if (unclassified.length > 0) {
        throw new Error(
            `exportMetadata: ${unclassifiedTablesErrorMessage(unclassified)}`
        )
    }

    const allTablesSet = new Set(allTables)
    const stale = [...INCLUDE_DATA_TABLES, ...SCHEMA_ONLY_TABLES].filter(
        (t) => !allTablesSet.has(t)
    )
    if (stale.length > 0) {
        console.warn(
            `exportMetadata: these listed tables no longer exist and can be ` +
                `removed from this script: ${stale.join(", ")}`
        )
    }
}

// Build INSERT statements for the users table with all sensitive fields wiped.
// We keep the id/isSuperuser/isActive/fullName/timestamps so that foreign-key
// references (lastEditedByUserId, createdByUserId, etc.) still resolve and the
// admin shows sensible authorship, but replace the email with a placeholder and
// NULL out every contact/integration identifier.
//
// User id=1 is always emitted as the canonical local admin account
// (admin@example.com), which the dev auth flow looks up by email to log in.
async function anonymisedUsersSql(): Promise<string> {
    const knex = db.knexInstance()
    const users = await db.knexRaw<{
        id: number
        isSuperuser: number
        isActive: number
        fullName: string
        email: string
        githubUsername: string
        createdAt: string
        updatedAt: string
    }>(
        knex,
        `SELECT id, isSuperuser, isActive, fullName, githubUsername,
                DATE_FORMAT(createdAt, '%Y-%m-%d %H:%i:%s') AS createdAt,
                DATE_FORMAT(updatedAt, '%Y-%m-%d %H:%i:%s') AS updatedAt
         FROM users WHERE id != 1 ORDER BY id`
    )

    const rows = users.map((u) => ({
        id: u.id,
        lastLogin: null,
        isSuperuser: u.isSuperuser,
        email: `user-${u.id}@example.com`, // not needed in staging/local dev
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
        isActive: u.isActive,
        fullName: u.fullName,
        lastSeen: null,
        githubUsername: u.githubUsername, // needed for staging tailscale auth
        dataInsightFolderId: null,
        slackId: null,
    }))

    const adminInsert =
        "INSERT INTO users (`id`, `isSuperuser`, `email`, `fullName`, `createdAt`, `updatedAt`, `isActive`) VALUES (1, 1, 'admin@example.com', 'Admin User', '2016-01-01 00:00:00', '2016-01-01 00:00:00', 1);\n"

    const usersInsert =
        rows.length > 0 ? knex("users").insert(rows).toQuery() + ";\n" : ""

    return adminInsert + usersInsert
}

async function dataExport(): Promise<void> {
    console.log(`Exporting database structure and metadata to ${filePath}...`)

    await assertAllTablesClassified()

    // Expose password to mysqldump
    // Safer than passing as an argument because it's not shown in 'ps aux'
    process.env.MYSQL_PWD = GRAPHER_DB_PASS

    // 1. Dump the schema of *all* tables and views (no data). This guarantees a
    //    complete database structure regardless of which tables we export data
    //    for below.
    await execWrapper(
        `mysqldump --no-defaults --default-character-set=utf8mb4 --no-tablespaces --no-data -u '${GRAPHER_DB_USER}' -h '${GRAPHER_DB_HOST}' -P ${GRAPHER_DB_PORT} ${GRAPHER_DB_NAME} -r ${filePath}`
    )

    // 2. Append data only for the whitelisted tables.
    await execWrapper(
        `mysqldump --no-defaults --default-character-set=utf8mb4 --no-tablespaces --column-statistics --no-create-info -u '${GRAPHER_DB_USER}' -h '${GRAPHER_DB_HOST}' -P ${GRAPHER_DB_PORT} ${GRAPHER_DB_NAME} ${INCLUDE_DATA_TABLES.join(
            " "
        )} >> ${filePath}`
    )

    // 3. Append anonymised user rows (including the local admin account).
    await fs.appendFile(filePath, await anonymisedUsersSql())

    await db.closeTypeOrmAndKnexConnections()
}

void dataExport()
