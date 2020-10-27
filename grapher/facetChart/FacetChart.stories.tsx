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
    const table = SynthesizeGDPTable({
        entityCount: 4,
    })
    const manager = {
        table,
        selection: table.availableEntityNames,
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
    const table = SynthesizeFruitTable({
        entityCount: 4,
    })
    return (
        <svg width={bounds.width} height={bounds.height}>
            <FacetChart
                bounds={bounds}
                chartTypeName={ChartTypeName.LineChart}
                manager={{
                    selection: table.availableEntityNames,
                    table,
                }}
            />
        </svg>
    )
}

export const OneChartPerMetric = () => {
    const table = SynthesizeGDPTable({
        entityCount: 2,
    })
    return (
        <svg width={bounds.width} height={bounds.height}>
            <FacetChart
                bounds={bounds}
                chartTypeName={ChartTypeName.LineChart}
                manager={{
                    facetStrategy: FacetStrategy.column,
                    yColumnSlugs: table.numericColumnSlugs,
                    selection: table.availableEntityNames,
                    table,
                }}
            />
        </svg>
    )
}
