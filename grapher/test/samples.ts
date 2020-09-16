import { parseDelimited } from "grapher/utils/Util"
import { Grapher } from "grapher/core/Grapher"

// Todo: improve ChartScript to ditch owidVariableId.
export function basicGdpGrapher() {
    const grapher = new Grapher({
        manuallyProvideData: true,
        dimensions: [{ variableId: 99, property: "y" }],
    })
    const table = grapher.table
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
    table.cloneAndAddRowsAndDetectColumns(rows)
    table.columnsBySlug.get("gdp")!.spec.owidVariableId = 99
    table.columnsBySlug.get("population")!.spec.owidVariableId = 100
    table.setSelectedEntities(["France", "Germany"])
    return grapher
}

export const basicScatterGrapher = () => {
    const grapher = basicGdpGrapher()
    grapher.type = "ScatterPlot"
    grapher.yAxis.min = 0
    grapher.yAxis.max = 500
    grapher.xAxis.min = 0
    grapher.xAxis.max = 500
    grapher.addDimension({ variableId: 100, property: "x" })
    return grapher
}
