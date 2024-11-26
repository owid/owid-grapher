import React from "react"
import { FacetChart } from "./FacetChart"
import {
    SampleColumnSlugs,
    SynthesizeFruitTable,
    SynthesizeGDPTable,
} from "@ourworldindata/core-table"
import { Bounds } from "@ourworldindata/utils"
import { FacetStrategy, GRAPHER_CHART_TYPES } from "@ourworldindata/types"
import { ChartManager } from "../chart/ChartManager"

// See https://storybook.js.org/docs/react/essentials/controls for Control Types
const CSF = {
    title: "FacetChart",
    component: FacetChart,
}

export default CSF

const bounds = new Bounds(0, 0, 1000, 500)

export const OneMetricOneCountryPerChart = (): React.ReactElement => {
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
                chartTypeName={GRAPHER_CHART_TYPES.LineChart}
                manager={manager}
            />
        </svg>
    )
}

export const MultipleMetricsOneCountryPerChart = (): React.ReactElement => {
    const table = SynthesizeFruitTable({
        entityCount: 4,
    })
    return (
        <svg width={bounds.width} height={bounds.height}>
            <FacetChart
                bounds={bounds}
                chartTypeName={GRAPHER_CHART_TYPES.LineChart}
                manager={{
                    selection: table.availableEntityNames,
                    table,
                }}
            />
        </svg>
    )
}

export const OneChartPerMetric = (): React.ReactElement => {
    const table = SynthesizeGDPTable({
        entityCount: 2,
    })
    return (
        <svg width={bounds.width} height={bounds.height}>
            <FacetChart
                bounds={bounds}
                chartTypeName={GRAPHER_CHART_TYPES.LineChart}
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
