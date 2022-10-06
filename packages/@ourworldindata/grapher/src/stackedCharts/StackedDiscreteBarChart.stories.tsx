import React from "react"
import { StackedDiscreteBarChart } from "./StackedDiscreteBarChart.js"
import { SynthesizeFruitTable } from "@ourworldindata/core-table"

export default {
    title: "StackedDiscreteBarChart",
    component: StackedDiscreteBarChart,
}

export const ColumnsAsSeries = (): JSX.Element => {
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

export const ColumnsAsSeriesRelative = (): JSX.Element => {
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
