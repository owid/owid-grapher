// Script to export everything in the database except sensitive info and data_values (which is big)

import * as db from '../db'
import * as shell from 'shelljs'
import * as settings from '../settings'
import * as fs from 'fs-extra'
import * as path from 'path'

async function dataExport() {
    db.connect()

    const outputPath = path.join(settings.BASE_DIR, `fixtures/owid_metadata.sql`)

    console.log(`Exporting database structure and metadata to ${outputPath}...`)

    // Dump all tables but exclude the rows of data_values
    shell.exec(`mysqldump ${settings.DB_NAME} --ignore-table=${settings.DB_NAME}.data_values -r /tmp/owid_metadata.sql`)
    shell.exec(`mysqldump --no-data ${settings.DB_NAME} data_values >> /tmp/owid_metadata.sql`)

    // Strip passwords
    shell.exec(`sed -i -e "s/bcrypt[^']*//g" /tmp/owid_metadata.sql`)

    // Add default admin user
    await fs.appendFile("/tmp/owid_metadata.sql", "INSERT INTO users (`password`, `is_superuser`, `email`, `name`, `created_at`, `updated_at`, `is_active`) VALUES ('bcrypt$$2b$12$EXfM7cWsjlNchpinv.j6KuOwK92hihg5r3fNssty8tLCUpOubST9u', 1, 'admin@example.com', 'admin', '2016-01-01 00:00:00', '2016-01-01 00:00:00', 1);\n")

    await fs.move("/tmp/owid_metadata.sql", outputPath, { overwrite: true })

    db.end()
}

dataExport()