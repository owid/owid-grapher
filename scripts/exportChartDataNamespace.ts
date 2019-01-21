// Script to export the data_values for all variables attached to charts

import * as path from 'path'
import * as db from 'db/db'
import * as _ from 'lodash'
import { DB_NAME } from 'serverSettings'

import { exec } from 'utils/server/serverUtil'

const namespace = process.argv[2]

if (!namespace) {
    const programName = path.basename(process.argv[1])
    console.log(`Usage:\n${programName} [namespace]`)
    process.exit(1)
}

async function dataExport() {
    await db.connect()

    const tmpFile = `/tmp/owid_chartdata_${namespace}.sql`

    // This will also retrieve variables that are not in the specified namespace
    // but are used in a chart that has at least one variable from the specified
    // namespace.
    // This is necessary in order to reproduce the charts from the live grapher
    // accurately.
    const rows = await db.query(`
        SELECT DISTINCT chart_dimensions.variableId
        FROM chart_dimensions
        WHERE chart_dimensions.chartId IN (
            SELECT DISTINCT charts.id
            FROM charts
            JOIN chart_dimensions ON chart_dimensions.chartId = charts.id
            JOIN variables ON variables.id = chart_dimensions.variableId
            JOIN datasets ON datasets.id = variables.datasetId
            WHERE datasets.namespace = ?
        )
    `, [namespace])

    const variableIds = rows.map((row: any) => row.variableId)

    console.log(`Exporting data for ${variableIds.length} variables to ${tmpFile}`)

    await exec(`rm -f ${tmpFile}`)

    let count = 0
    for (const chunk of _.chunk(variableIds, 100)) {
        await exec(`mysqldump --no-create-info ${DB_NAME} data_values --where="variableId IN (${chunk.join(",")})" >> ${tmpFile}`)

        count += chunk.length
        console.log(count)
    }

    await db.end()
}

dataExport()
