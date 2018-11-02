// Script to export the data_values for all variables attached to charts

import * as db from '../db'
import * as _ from 'lodash'
import * as settings from '../settings'

import { exec } from '../admin/serverUtil'

async function dataExport() {
    await db.connect()

    const tmpFile = "/tmp/owid_chartdata.sql"

    const variablesToExportQuery = `
        SELECT DISTINCT cd.variableId FROM chart_dimensions cd
        JOIN variables v ON cd.variableId = v.id
        JOIN datasets d ON v.datasetId = d.id
        WHERE d.isPrivate IS FALSE
    `

    const variableIds = (await db.query(variablesToExportQuery)).map((row: any) => row.variableId)

    console.log(`Exporting data for ${variableIds.length} variables to ${tmpFile}`)

    await exec(`rm -f ${tmpFile}`)

    let count = 0
    for (const chunk of _.chunk(variableIds, 100)) {
        await exec(`mysqldump --no-create-info ${settings.DB_NAME} data_values --where="variableId IN (${chunk.join(",")})" >> ${tmpFile}`)

        count += chunk.length
        console.log(count)
    }

    await db.end()
}

dataExport()
