import { ChartScript } from "charts/core/ChartScript"
import { parseDelimited } from "charts/utils/Util"
import { ChartConfig } from "charts/core/ChartConfig"

// Todo: improve ChartScript to ditch "v2", selectedData, and owidVariableId.
export function basicGdpChart() {
    const props = {
        selectedData: [
            { index: 0, entityId: 0 },
            { index: 0, entityId: 1 }
        ],
        data: { availableEntities: ["Germany", "France"] },
        useV2: true,
        yAxis: {},
        dimensions: [{ variableId: 99, property: "y" }]
    } as Partial<ChartScript>

    const chartConfig = new ChartConfig(props as any)
    const rows = parseDelimited(`entityName,year,gdp,entityId,population
France,2000,100,0,123
Germany,2000,200,1,125
France,2001,200,0,128
Germany,2001,300,1,130
France,2002,220,0,154
Germany,2002,320,1,167
France,2003,120,0,200
Germany,2003,120,1,256`) as any
    rows.forEach((row: any) => {
        // Todo: parsing numerics should be automatic
        row.entityId = parseInt(row.entityId)
        row.gdp = parseInt(row.gdp)
        row.year = parseInt(row.year)
        row.population = parseInt(row.population)
    })
    chartConfig.table.cloneAndAddRowsAndDetectColumns(rows)
    chartConfig.table.columnsBySlug.get("gdp")!.spec.owidVariableId = 99
    chartConfig.table.columnsBySlug.get("population")!.spec.owidVariableId = 100
    return chartConfig
}

export const basicScatter = () => {
    const chartRuntime = basicGdpChart()
    const script = chartRuntime.props
    script.type = "ScatterPlot"
    chartRuntime.yAxisOptions.min = 0
    chartRuntime.yAxisOptions.max = 500
    chartRuntime.xAxisOptions.min = 0
    chartRuntime.xAxisOptions.max = 500
    script.dimensions.push({ variableId: 100, property: "x", display: {} })
    return chartRuntime
}
