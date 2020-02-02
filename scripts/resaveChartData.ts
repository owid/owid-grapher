import { ChartConfig } from "charts/ChartConfig"
import db = require("db/db")
import { Chart } from "db/model/Chart"
import { getVariableData } from "db/model/Variable"
import _ = require("lodash")

async function main() {
    ;(global as any).window = {}
    ;(global as any).App = {}
    const chartRows = await Chart.all()
    for (const c of chartRows) {
        const chart = new ChartConfig(c.config)
        chart.isLocalExport = true
        const variableIds = _.uniq(chart.dimensions.map(d => d.variableId))
        const vardata = await getVariableData(variableIds)
        chart.vardata.receiveData(vardata)

        c.config.data = chart.data.json
        console.log(c.id)
        await db
            .table("charts")
            .where({ id: c.id })
            .update({ config: JSON.stringify(c.config) })
    }

    await db.end()
}

main()
