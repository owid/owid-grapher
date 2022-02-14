// Script to export the data_values for all variables attached to charts

import * as db from "./db.js"
import * as lodash from "lodash-es"
import parseArgs from "minimist"

import {
    DB_NAME,
    DB_USER,
    DB_PASS,
    DB_HOST,
    DB_PORT,
} from "../settings/serverSettings.js"
import { execWrapper } from "./execWrapper.js"

const argv = parseArgs(process.argv.slice(2))
const filePath = argv._[0] || "/tmp/owid_chartdata.sql"

const dataExport = async (): Promise<void> => {
    await db.getConnection()

    const variablesToExportQuery = `
        SELECT DISTINCT cd.variableId FROM chart_dimensions cd
        WHERE NOT EXISTS (select * from tags t join chart_tags ct on ct.tagId = t.id where ct.chartId=cd.chartId and t.name='Private')
    `

    const variableIds = (await db.queryMysql(variablesToExportQuery)).map(
        (row: any) => row.variableId
    )

    console.log(
        `Exporting data for ${variableIds.length} variables to ${filePath}`
    )

    await execWrapper(`rm -f ${filePath}`)

    // Expose password to mysqldump
    // Safer than passing as an argument because it's not shown in 'ps aux'
    process.env.MYSQL_PWD = DB_PASS

    let count = 0
    for (const chunk of lodash.chunk(variableIds, 100)) {
        await execWrapper(
            `mysqldump --default-character-set=utf8mb4 --no-tablespaces --no-create-info -u '${DB_USER}' -h '${DB_HOST}' -P ${DB_PORT} ${DB_NAME} data_values --where="variableId IN (${chunk.join(
                ","
            )})" >> ${filePath}`
        )

        count += chunk.length
        console.log(count)
    }

    await db.closeTypeOrmAndKnexConnections()
}

dataExport()
