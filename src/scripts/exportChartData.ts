// Script to export the data_values for all variables attached to charts

import * as db from '../db'
import * as shell from 'shelljs'
import * as _ from 'lodash'
import * as settings from '../settings'
import * as path from 'path'
import * as fs from 'fs-extra'

import {createConnection} from "typeorm";
import {TestChart} from '../models/Chart'

async function dataExport() {
    const connection = await createConnection({
        type: "mysql",
        host: "localhost",
        port: 3306,
        username: "root",
        password: "",
        database: "owid",
        entities: [TestChart]
    })

    console.log(await TestChart.find())

    connection.close()
/*    db.connect()

    const tmpFile = "/tmp/owid_chartdata.sql"
    const outputPath = path.join(settings.BASE_DIR, `fixtures/owid_chartdata.sql`)

    const variableIds = (await db.query("SELECT DISTINCT variableId FROM chart_dimensions")).map((row: any) => row.variableId)

    console.log(`Exporting data for ${variableIds.length} variables to ${outputPath}`)

    shell.exec(`rm -f ${tmpFile}`)

    let count = 0
    for (const chunk of _.chunk(variableIds, 100)) {
        shell.exec(`mysqldump --no-create-info ${settings.DB_NAME} data_values --where="variableId IN (${chunk.join(",")})" >> ${tmpFile}`)

        count += chunk.length
        console.log(count)
    }

    await fs.move(tmpFile, outputPath, { overwrite: true })

    db.end()*/
}

dataExport()