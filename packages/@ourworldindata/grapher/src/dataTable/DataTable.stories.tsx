import React from "react"
import { DataTable, DataTableManager } from "./DataTable"
import { SynthesizeGDPTable } from "@ourworldindata/core-table"
import { ChartTypeName, GrapherTabOption } from "@ourworldindata/types"
import {
    childMortalityGrapher,
    GrapherWithIncompleteData,
} from "./DataTable.sample"

export default {
    title: "DataTable",
    component: DataTable,
}

const table = SynthesizeGDPTable({
    timeRange: [1950, 2010],
    entityCount: 7,
})

const entityType = "country"

export const Default = (): React.ReactElement => {
    const manager: DataTableManager = {
        table,
        tableForDisplay: table,
        entityType,
    }
    return <DataTable manager={manager} />
}

export const WithTimeRange = (): React.ReactElement => {
    const manager: DataTableManager = {
        table,
        tableForDisplay: table,
        entityType,
    }
    manager.startTime = 1950
    manager.endTime = 2000
    return <DataTable manager={manager} />
}

export const WithTolerance = (): React.ReactElement => {
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

    const filteredTable = table.dropRowsAt([0, 10, 11])

    return (
        <div>
            <DataTable
                manager={{
                    table,
                    tableForDisplay: table,
                    startTime: 2010,
                    endTime: 2010,
                    entityType,
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
                    tableForDisplay: filteredTable,
                    entityType,
                }}
            />
        </div>
    )
}

export const FromLegacy = (): React.ReactElement => {
    const grapher = childMortalityGrapher()
    return <DataTable manager={grapher} />
}

export const FromLegacyWithTimeRange = (): React.ReactElement => {
    const grapher = childMortalityGrapher({
        type: ChartTypeName.LineChart,
        tab: GrapherTabOption.chart,
    })
    grapher.startHandleTimeBound = 1950
    grapher.endHandleTimeBound = 2019
    return <DataTable manager={grapher} />
}

export const IncompleteDataTableComponent = (): React.ReactElement => {
    const grapher = GrapherWithIncompleteData()
    grapher.timelineHandleTimeBounds = [2000, 2000]
    return <DataTable manager={grapher} />
}

// grapher.timeDomain = [2009, 2017]
// Todo: how can I get this to show a closest time popup?
