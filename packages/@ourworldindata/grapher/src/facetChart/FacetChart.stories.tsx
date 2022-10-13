import React from "react"
import { FacetChart } from "./FacetChart"
import {
    SampleColumnSlugs,
    SynthesizeFruitTable,
    SynthesizeGDPTable,
} from "@ourworldindata/core-table"
import { Bounds } from "@ourworldindata/utils"
import { ChartTypeName, FacetStrategy } from "../core/GrapherConstants"
import { Meta } from "@storybook/react"
import { ChartManager } from "../chart/ChartManager"

// See https://storybook.js.org/docs/react/essentials/controls for Control Types
const CSF: Meta = {
    title: "FacetChart",
    component: FacetChart,
}

export default CSF

const bounds = new Bounds(0, 0, 1000, 500)

export const OneMetricOneCountryPerChart = (): JSX.Element => {
    const table = SynthesizeGDPTable({
        entityCount: 4,
    })
    const manager: ChartManager = {
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

export const MultipleMetricsOneCountryPerChart = (): JSX.Element => {
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

export const OneChartPerMetric = (): JSX.Element => {
    const table = SynthesizeGDPTable({
        entityCount: 2,
    })
    return (
        <svg width={bounds.width} height={bounds.height}>
            <FacetChart
                bounds={bounds}
                chartTypeName={ChartTypeName.LineChart}
                manager={{
                    facetStrategy: FacetStrategy.metric,
                    yColumnSlugs: table.numericColumnSlugs,
                    selection: table.availableEntityNames,
                    table,
                }}
            />
        </svg>
    )
}
