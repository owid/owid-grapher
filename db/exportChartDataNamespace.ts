// Script to export the data_values for all variables attached to charts

import * as path from "path"
import * as db from "db/db"
import * as lodash from "lodash"
import { DB_NAME, DB_USER, DB_PASS, DB_HOST, DB_PORT } from "serverSettings"

import { exec } from "adminSiteServer/serverUtil"

const namespacesArg: string = process.argv[2]

if (!namespacesArg) {
    const programName = path.basename(process.argv[1])
    console.log(`Usage:\n${programName} [namespaces]`)
    process.exit(1)
}

const namespaces: string[] = namespacesArg.split(",")

async function dataExport() {
    await db.connect()

    const tmpFilename: string = `/tmp/owid_chartdata_${namespaces.join(
        ","
    )}.sql`

    // This will also retrieve variables that are not in the specified namespace
    // but are used in a chart that has at least one variable from the specified
    // namespace.
    // This is necessary in order to reproduce the charts from the live grapher
    // accurately.
    const rows = await db.query(
        `
        SELECT DISTINCT chart_dimensions.variableId
        FROM chart_dimensions
        WHERE chart_dimensions.chartId IN (
            SELECT DISTINCT charts.id
            FROM charts
            JOIN chart_dimensions ON chart_dimensions.chartId = charts.id
            JOIN variables ON variables.id = chart_dimensions.variableId
            JOIN datasets ON datasets.id = variables.datasetId
            WHERE datasets.namespace IN (?)
        )
    `,
        [namespaces]
    )

    const variableIds = rows.map((row: any) => row.variableId)

    console.log(
        `Exporting data for ${variableIds.length} variables to ${tmpFilename}`
    )

    await exec(`rm -f ${tmpFilename}`)

    // Expose password to mysqldump
    // Safer than passing as an argument because it's not shown in 'ps aux'
    process.env.MYSQL_PWD = DB_PASS

    let count = 0
    for (const chunk of lodash.chunk(variableIds, 100)) {
        await exec(
            `mysqldump --default-character-set=utf8mb4 --no-tablespaces --no-create-info -u '${DB_USER}' -h '${DB_HOST}' -P ${DB_PORT} ${DB_NAME} data_values --where="variableId IN (${chunk.join(
                ","
            )})" >> ${tmpFilename}`
        )

        count += chunk.length
        console.log(count)
    }

    await db.end()
}

dataExport()
