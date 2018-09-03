// Script to export everything in the database except sensitive info and data_values (which is big)

import * as db from '../db'
import * as shell from 'shelljs'
import * as settings from '../settings'
import * as fs from 'fs-extra'

async function dataExport() {
    await db.connect()

    console.log(`Exporting database structure and metadata to /tmp/owid_metadata.sql...`)

    // Dump all tables including schema but exclude the rows of data_values
    shell.exec(`mysqldump ${settings.DB_NAME} --ignore-table=${settings.DB_NAME}.django_session --ignore-table=${settings.DB_NAME}.user_invitations --ignore-table=${settings.DB_NAME}.data_values -r /tmp/owid_metadata.sql`)
    shell.exec(`mysqldump --no-data ${settings.DB_NAME} django_session user_invitations data_values >> /tmp/owid_metadata.sql`)

    // Strip passwords
    shell.exec(`sed -i -e "s/bcrypt[^']*//g" /tmp/owid_metadata.sql`)

    // Add default admin user
    await fs.appendFile("/tmp/owid_metadata.sql", "INSERT INTO users (`password`, `is_superuser`, `email`, `name`, `createdAt`, `updatedAt`, `is_active`) VALUES ('bcrypt$$2b$12$EXfM7cWsjlNchpinv.j6KuOwK92hihg5r3fNssty8tLCUpOubST9u', 1, 'admin@example.com', 'admin', '2016-01-01 00:00:00', '2016-01-01 00:00:00', 1);\n")

    await db.end()
}

dataExport()