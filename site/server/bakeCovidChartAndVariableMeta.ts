#! /usr/bin/env yarn tsn

import * as db from "db/db"
import * as fs from "fs-extra"
import { getVariableData } from "db/model/Variable"
import { covidChartAndVariableMetaFilename } from "charts/covidDataExplorer/CovidConstants"

const variableIds = [
    123,
    142582,
    142583,
    142600,
    142601,
    142712,
    142721,
    142754
]
const chartIds = [4018, 4019, 4020, 4021, 4197, 4198, 4258]

export const bakeCovidChartAndVariableMeta = async () => {
    const output: any = {
        NOTICE: "This file is generated. Hand edits will be overwritten.",
        charts: {},
        variables: {}
    }

    const charts = await db.query(
        `select id, config from charts where id in (${chartIds.join(",")})`
    )
    charts.forEach((row: any) => {
        const config = JSON.parse(row.config)
        delete config.data
        delete config.selectedData
        output.charts[row.id] = config
    })

    const vars = await getVariableData(variableIds)
    Object.values(vars.variables).forEach((row: any) => {
        delete row.years
        delete row.entities
        delete row.values
        output.variables[row.id] = row
    })

    return JSON.stringify(output)
}

const main = async () => {
    // Bake this file locally for development
    const outputFilePath = `${__dirname}/../../public/${covidChartAndVariableMetaFilename}`
    const str = await bakeCovidChartAndVariableMeta()
    fs.writeFileSync(outputFilePath, str)
    db.end()
}

if (!module.parent) main()
