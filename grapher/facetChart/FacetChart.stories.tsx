import * as React from "react"
import { FacetChart } from "./FacetChart"
import {
    SampleColumnSlugs,
    SynthesizeFruitTable,
    SynthesizeGDPTable,
} from "coreTable/OwidTableSynthesizers"
import { Bounds } from "grapher/utils/Bounds"
import { ChartTypeName, FacetStrategy } from "grapher/core/GrapherConstants"
import { Meta } from "@storybook/react"

// See https://storybook.js.org/docs/react/essentials/controls for Control Types
const CSF: Meta = {
    title: "FacetChart",
    component: FacetChart,
}

export default CSF

const bounds = new Bounds(0, 0, 1000, 500)

export const OneMetricOneCountryPerChart = () => {
    const manager = {
        table: SynthesizeGDPTable({
            entityCount: 4,
        }).selectAll(),
        yColumnSlug: SampleColumnSlugs.GDP,
        xColumnSlug: SampleColumnSlugs.Population,
    }

    return (
        <svg width={bounds.width} height={bounds.height}>
            <FacetChart
                bounds={bounds}
                chartTypeName={ChartTypeName.LineChart}
                manager={manager}
            />
        </svg>
    )
}

export const MultipleMetricsOneCountryPerChart = () => {
    return (
        <svg width={bounds.width} height={bounds.height}>
            <FacetChart
                bounds={bounds}
                chartTypeName={ChartTypeName.LineChart}
                manager={{
                    table: SynthesizeFruitTable({
                        entityCount: 4,
                    }).selectAll(),
                }}
            />
        </svg>
    )
}

export const OneChartPerMetric = () => {
    const table = SynthesizeGDPTable({
        entityCount: 2,
    }).selectAll()
    return (
        <svg width={bounds.width} height={bounds.height}>
            <FacetChart
                bounds={bounds}
                chartTypeName={ChartTypeName.LineChart}
                manager={{
                    facetStrategy: FacetStrategy.column,
                    yColumnSlugs: table.numericColumnSlugs,
                    table,
                }}
            />
        </svg>
    )
}
