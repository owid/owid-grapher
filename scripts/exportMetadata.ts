// Script to export everything in the database except sensitive info and data_values (which is big)

import * as db from 'db/db'
import * as fs from 'fs-extra'

import { DB_NAME, DB_USER, DB_PASS, DB_HOST, DB_PORT } from 'serverSettings'
import { exec } from 'utils/server/serverUtil'

async function dataExport() {
    await db.connect()

    console.log(`Exporting database structure and metadata to /tmp/owid_metadata.sql...`)

    // Expose password to mysqldump
    // Safer than passing as an argument because it's not shown in 'ps aux'
    process.env.MYSQL_PWD = DB_PASS

    // Dump all tables including schema but exclude the rows of data_values
    await exec(`mysqldump -u '${DB_USER}' -h '${DB_HOST}' -P ${DB_PORT} ${DB_NAME} --ignore-table=${DB_NAME}.sessions --ignore-table=${DB_NAME}.user_invitations --ignore-table=${DB_NAME}.dataset_files --ignore-table=${DB_NAME}.data_values -r /tmp/owid_metadata.sql`)
    await exec(`mysqldump -u '${DB_USER}' -h '${DB_HOST}' -P ${DB_PORT} --no-data ${DB_NAME} sessions user_invitations data_values >> /tmp/owid_metadata.sql`)

    // Strip passwords
    await exec(`sed -i -e "s/bcrypt[^']*//g" /tmp/owid_metadata.sql`)

    // Add default admin user
    await fs.appendFile("/tmp/owid_metadata.sql", "INSERT INTO users (`password`, `isSuperuser`, `email`, `fullName`, `createdAt`, `updatedAt`, `isActive`) VALUES ('bcrypt$$2b$12$EXfM7cWsjlNchpinv.j6KuOwK92hihg5r3fNssty8tLCUpOubST9u', 1, 'admin@example.com', 'Admin User', '2016-01-01 00:00:00', '2016-01-01 00:00:00', 1);\n")

    await db.end()
}

dataExport()
