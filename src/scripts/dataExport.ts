// Experimental script to export the data_values for all variables attached to charts

import * as db from '../db'
import * as shell from 'shelljs'
import * as _ from 'lodash'
import * as settings from '../settings'

async function dataExport() {
    db.connect()

    const variableIds = (await db.query("SELECT DISTINCT variableId FROM chart_dimensions")).map((row: any) => row.variableId)

    console.log(`Exporting data for ${variableIds.length} variables`)
    shell.exec(`rm -rf /tmp/data_values.sql`)

    let count = 0
    for (const chunk of _.chunk(variableIds, 100)) {
        shell.exec(`mysqldump --no-create-info ${settings.DB_NAME} data_values --where="variableId IN (${chunk.join(",")})" >> /tmp/data_values.sql`)

        count += chunk.length
        console.log(count)
    }

    db.end()
}

dataExport()