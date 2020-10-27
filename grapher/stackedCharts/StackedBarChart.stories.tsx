import * as React from "react"
import { StackedBarChart } from "./StackedBarChart"
import {
    SampleColumnSlugs,
    SynthesizeFruitTable,
    SynthesizeGDPTable,
} from "coreTable/OwidTableSynthesizers"

export default {
    title: "StackedBarChart",
    component: StackedBarChart,
}

export const ColumnsAsSeries = () => {
    const table = SynthesizeFruitTable()

    return (
        <svg width={600} height={600}>
            <StackedBarChart
                manager={{ table, selection: table.sampleEntityName(1) }}
            />
        </svg>
    )
}

export const EntitiesAsSeries = () => {
    const table = SynthesizeGDPTable({ entityCount: 5 })
    const manager = {
        table,
        selection: table.availableEntityNames,
        yColumnSlugs: [SampleColumnSlugs.Population],
    }

    return (
        <svg width={600} height={600}>
            <StackedBarChart manager={manager} />
        </svg>
    )
}

export const EntitiesAsSeriesWithMissingRows = () => {
    const table = SynthesizeGDPTable({ entityCount: 5 }).dropRandomRows(30)
    const manager = {
        table,
        selection: table.availableEntityNames,
        yColumnSlugs: [SampleColumnSlugs.Population],
    }

    return (
        <svg width={600} height={600}>
            <StackedBarChart manager={manager} />
        </svg>
    )
}
