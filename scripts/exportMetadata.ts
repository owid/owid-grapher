// Script to export everything in the database except sensitive info and data_values (which is big)

import * as db from "db/db"
import * as fs from "fs-extra"
import parseArgs from "minimist"

import { DB_NAME, DB_USER, DB_PASS, DB_HOST, DB_PORT } from "serverSettings"
import { exec } from "utils/server/serverUtil"

const argv = parseArgs(process.argv.slice(2))
const withPasswords = argv["with-passwords"]

const filePath =
    argv._[0] ||
    (!withPasswords
        ? "/tmp/owid_metadata.sql"
        : "/tmp/owid_metadata_with_passwords.sql")

const excludeTables = [
    "sessions",
    "password_resets",
    "user_invitations",
    "dataset_files",
    "data_values"
]

async function dataExport() {
    await db.connect()

    console.log(`Exporting database structure and metadata to ${filePath}...`)

    // Expose password to mysqldump
    // Safer than passing as an argument because it's not shown in 'ps aux'
    process.env.MYSQL_PWD = DB_PASS

    // Dump all tables including schema but exclude the rows of data_values
    await exec(
        `mysqldump --default-character-set=utf8mb4 -u '${DB_USER}' -h '${DB_HOST}' -P ${DB_PORT} ${DB_NAME} ${excludeTables
            .map(tableName => `--ignore-table=${DB_NAME}.${tableName}`)
            .join(" ")} -r ${filePath}`
    )
    await exec(
        `mysqldump --default-character-set=utf8mb4 -u '${DB_USER}' -h '${DB_HOST}' -P ${DB_PORT} --no-data ${DB_NAME} ${excludeTables.join(
            " "
        )} >> ${filePath}`
    )

    if (!withPasswords) {
        // Strip passwords
        await exec(`sed -i -e "s/bcrypt[^']*//g" ${filePath}`)
        // Add default admin user
        await fs.appendFile(
            filePath,
            "INSERT INTO users (`password`, `isSuperuser`, `email`, `fullName`, `createdAt`, `updatedAt`, `isActive`) VALUES ('bcrypt$$2b$12$EXfM7cWsjlNchpinv.j6KuOwK92hihg5r3fNssty8tLCUpOubST9u', 1, 'admin@example.com', 'Admin User', '2016-01-01 00:00:00', '2016-01-01 00:00:00', 1);\n"
        )
    }

    await db.end()
}

dataExport()
