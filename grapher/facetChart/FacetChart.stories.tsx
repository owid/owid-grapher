import * as React from "react"
import { FacetChart } from "./FacetChart"
import {
    SampleColumnSlugs,
    SynthesizeFruitTable,
    SynthesizeGDPTable,
} from "../../coreTable/OwidTableSynthesizers"
import { Bounds } from "../../clientUtils/Bounds"
import { ChartTypeName, FacetStrategy } from "../core/GrapherConstants"
import { Meta } from "@storybook/react"
import { AxisConfig } from "../axis/AxisConfig"

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
    const manager = {
        table,
        selection: table.availableEntityNames,
        yColumnSlug: SampleColumnSlugs.GDP,
        xColumnSlug: SampleColumnSlugs.Population,
        yAxis: new AxisConfig(),
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
                    yAxis: new AxisConfig(),
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
                    facetStrategy: FacetStrategy.column,
                    yColumnSlugs: table.numericColumnSlugs,
                    selection: table.availableEntityNames,
                    table,
                }}
            />
        </svg>
    )
}
