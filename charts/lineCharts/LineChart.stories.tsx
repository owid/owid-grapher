import * as React from "react"
import "site/client/owid.scss"
import "charts/core/chart.scss"
import { LineChart } from "charts/lineCharts/LineChart"
import { ChartConfig, ChartConfigProps } from "charts/core/ChartConfig"
import { parseDelimited } from "charts/utils/Util"
import { OwidTable } from "owidTable/OwidTable"

export default {
    title: "LineChart",
    component: LineChart
}

export const Default = () => {
    const props = {
        selectedData: [
            { index: 0, entityId: 0 },
            { index: 0, entityId: 1 }
        ],
        data: { availableEntities: ["Germany", "France"] },
        useV2: true,
        yAxis: {},
        dimensions: [{ variableId: 99, property: "y" }]
    } as Partial<ChartConfigProps>

    const chartConfig = new ChartConfig(props as any)
    const rows = parseDelimited(`entityName,year,gdp,entityId
France,2000,100,0
Germany,2000,200,1
France,2001,200,0
Germany,2001,300,1
France,2002,220,0
Germany,2002,320,1
France,2003,120,0
Germany,2003,120,1`) as any
    rows.forEach((row: any) => (row.entityId = parseInt(row.entityId)))
    chartConfig.table.cloneAndAddRowsAndDetectColumns(rows)
    chartConfig.table.columnsBySlug.get("gdp")!.spec.owidVariableId = 99
    chartConfig.hideEntityControls = true

    return (
        <svg width={640} height={480}>
            <LineChart options={chartConfig} />
        </svg>
    )
}
