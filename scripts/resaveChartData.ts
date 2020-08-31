import * as db from "db/db"
import { Chart } from "db/model/Chart"
import { ChartConfig } from "charts/core/ChartConfig"
import * as lodash from "lodash"
import { getVariableData } from "db/model/Variable"

async function main() {
    ;(global as any).window = {}
    ;(global as any).App = {}
    const chartRows = await Chart.all()
    for (const c of chartRows) {
        const chart = new ChartConfig(c.config)
        chart.isExporting = true
        const variableIds = lodash.uniq(chart.dimensions.map(d => d.variableId))
        const vardata = await getVariableData(variableIds)
        chart.receiveData(vardata)

        // todo: remove?
        c.config.data = {
            availableEntities:
                chart.script.addCountryMode === "disabled"
                    ? []
                    : chart.availableEntityNames
        }
        console.log(c.id)
        await db
            .table("charts")
            .where({ id: c.id })
            .update({ config: JSON.stringify(c.config) })
    }

    await db.end()
}

main()
