import * as React from "react"
import { DataTable, DataTableManager } from "./DataTable"
import { SynthesizeGDPTable } from "coreTable/OwidTable"
import { childMortalityGrapher } from "./DataTable.sample"
import { ChartTypeName, GrapherTabOption } from "grapher/core/GrapherConstants"

export default {
    title: "DataTable",
    component: DataTable,
}

const table = SynthesizeGDPTable({
    timeRange: [1950, 2010],
    entityCount: 7,
})

export const Default = () => {
    const manager: DataTableManager = {
        table,
    }
    return <DataTable manager={manager} />
}

export const WithTimeRange = () => {
    const manager: DataTableManager = {
        table,
    }
    manager.startTime = 1950
    manager.endTime = 2000
    return <DataTable manager={manager} />
}

export const WithTolerance = () => {
    const table = SynthesizeGDPTable(
        {
            timeRange: [2010, 2020],
            entityCount: 3,
        },
        3,
        {
            tolerance: 1,
        }
    )

    const filteredTable = table.withoutRows([
        table.rows[0],
        table.rows[10],
        table.rows[11],
    ])

    return (
        <div>
            <DataTable
                manager={{
                    table,
                    startTime: 2010,
                    endTime: 2010,
                }}
            />
            <div>
                One country with data, one with data within tolerance, one
                outside tolerance:
            </div>
            <DataTable
                manager={{
                    startTime: 2010,
                    endTime: 2010,
                    table: filteredTable,
                }}
            />
        </div>
    )
}

export const FromLegacy = () => {
    const grapher = childMortalityGrapher()
    return <DataTable manager={grapher} />
}

export const FromLegacyWithTimeRange = () => {
    const grapher = childMortalityGrapher({
        type: ChartTypeName.LineChart,
        tab: GrapherTabOption.chart,
    })
    grapher.startTime = 1950
    grapher.endTime = 2019
    return <DataTable manager={grapher} />
}

// grapher.timeDomain = [2009, 2017]
// Todo: how can I get this to show a closest time popup?
