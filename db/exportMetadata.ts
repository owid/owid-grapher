// Script to export everything in the database except sensitive info

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

const argv = parseArgs(process.argv.slice(2))
const withPasswords = argv["with-passwords"]

const filePath =
    argv._[0] ||
    (!withPasswords
        ? "/tmp/owid_metadata.sql"
        : "/tmp/owid_metadata_with_passwords.sql")

const excludeTables = ["analytics_pageviews", "donors", "sessions"]

async function dataExport(): Promise<void> {
    console.log(`Exporting database structure and metadata to ${filePath}...`)

    // Expose password to mysqldump
    // Safer than passing as an argument because it's not shown in 'ps aux'
    process.env.MYSQL_PWD = GRAPHER_DB_PASS

    // Dump all tables including schema
    await execWrapper(
        `mysqldump --default-character-set=utf8mb4 --no-tablespaces --column-statistics -u '${GRAPHER_DB_USER}' -h '${GRAPHER_DB_HOST}' -P ${GRAPHER_DB_PORT} ${GRAPHER_DB_NAME} ${excludeTables
            .map(
                (tableName) => `--ignore-table=${GRAPHER_DB_NAME}.${tableName}`
            )
            .join(" ")} -r ${filePath}`
    )
    await execWrapper(
        `mysqldump --default-character-set=utf8mb4 --no-tablespaces -u '${GRAPHER_DB_USER}' -h '${GRAPHER_DB_HOST}' -P ${GRAPHER_DB_PORT} --no-data ${GRAPHER_DB_NAME} ${excludeTables.join(
            " "
        )} >> ${filePath}`
    )

    if (!withPasswords) {
        // Strip passwords
        await execWrapper(`sed -i -e "s/bcrypt[^']*//g" ${filePath}`)
        // Add default admin user
        await fs.appendFile(
            filePath,
            "INSERT INTO users (`id`, `password`, `isSuperuser`, `email`, `fullName`, `createdAt`, `updatedAt`, `isActive`) VALUES (1, 'bcrypt$$2b$12$EXfM7cWsjlNchpinv.j6KuOwK92hihg5r3fNssty8tLCUpOubST9u', 1, 'admin@example.com', 'Admin User', '2016-01-01 00:00:00', '2016-01-01 00:00:00', 1);\n"
        )
    }

    await db.closeTypeOrmAndKnexConnections()
}

void dataExport()
