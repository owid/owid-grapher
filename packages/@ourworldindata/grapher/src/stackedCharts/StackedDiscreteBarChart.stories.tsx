import React from "react"
import { StackedDiscreteBarChart } from "./StackedDiscreteBarChart"
import { SynthesizeFruitTable } from "@ourworldindata/core-table"

export default {
    title: "StackedDiscreteBarChart",
    component: StackedDiscreteBarChart,
}

export const ColumnsAsSeries = (): React.ReactElement => {
    const table = SynthesizeFruitTable({
        timeRange: [2000, 2001],
        entityCount: 5,
    })

    return (
        <svg width={640} height={600}>
            <StackedDiscreteBarChart
                manager={{ table, selection: table.sampleEntityName(5) }}
            />
        </svg>
    )
}

export const ColumnsAsSeriesRelative = (): React.ReactElement => {
    const table = SynthesizeFruitTable({
        timeRange: [2000, 2001],
        entityCount: 5,
    })

    return (
        <svg width={640} height={600}>
            <StackedDiscreteBarChart
                manager={{
                    table,
                    selection: table.sampleEntityName(5),
                    isRelativeMode: true,
                }}
            />
        </svg>
    )
}
