import * as React from "react"
import { DiscreteBarChart } from "./DiscreteBarChart"
import {
    SampleColumnSlugs,
    SynthesizeFruitTable,
    SynthesizeGDPTable,
} from "coreTable/OwidTableSynthesizers"
import { DiscreteBarChartManager } from "./DiscreteBarChartConstants"

export default {
    title: "DiscreteBarChart",
    component: DiscreteBarChart,
}

export const EntitiesAsSeries = () => {
    const table = SynthesizeGDPTable({
        timeRange: [2009, 2010],
        entityCount: 10,
    }).selectAll()

    const manager: DiscreteBarChartManager = {
        table,
        yColumnSlug: SampleColumnSlugs.Population,
    }

    return (
        <svg width={600} height={600}>
            <DiscreteBarChart manager={manager} />
        </svg>
    )
}

export const ColumnsAsSeries = () => {
    const table = SynthesizeFruitTable({ entityCount: 1 }).selectAll()
    const manager: DiscreteBarChartManager = {
        table,
    }

    return (
        <svg width={600} height={600}>
            <DiscreteBarChart manager={manager} />
        </svg>
    )
}
