import * as React from "react"
import { StackedBarChart } from "./StackedBarChart"
import {
    SynthesizeFruitTable,
    SynthesizeGDPTable,
} from "coreTable/OwidTableSynthesizers"

export default {
    title: "StackedBarChart",
    component: StackedBarChart,
}

export const ColumnsAsSeries = () => {
    const table = SynthesizeFruitTable().selectSample(1)
    return (
        <svg width={600} height={600}>
            <StackedBarChart manager={{ table }} />
        </svg>
    )
}

export const EntitiesAsSeries = () => {
    const manager = {
        table: SynthesizeGDPTable({ entityCount: 5 }).selectAll(),
        yColumnSlugs: ["Population"],
    }

    return (
        <svg width={600} height={600}>
            <StackedBarChart manager={manager} />
        </svg>
    )
}

export const EntitiesAsSeriesWithMissingRows = () => {
    const manager = {
        table: SynthesizeGDPTable({ entityCount: 5 })
            .selectAll()
            .dropRandomRows(30),
        yColumnSlugs: ["Population"],
    }

    return (
        <svg width={600} height={600}>
            <StackedBarChart manager={manager} />
        </svg>
    )
}
