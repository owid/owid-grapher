import * as React from "react"
import { FacetChart } from "./FacetChart"
import { SynthesizeFruitTable, SynthesizeGDPTable } from "coreTable/OwidTable"
import { Bounds } from "grapher/utils/Bounds"
import { ChartTypeName, FacetStrategy } from "grapher/core/GrapherConstants"
import { Meta } from "@storybook/react"

// See https://storybook.js.org/docs/react/essentials/controls for Control Types
const CSF: Meta = {
    title: "FacetChart",
    component: FacetChart,
    argTypes: {
        countryCount: {
            defaultValue: 10,
            control: { type: "range", min: 1, max: 200 },
        },
        chartTypeName: {
            defaultValue: ChartTypeName.LineChart,
            control: { type: "radio", options: Object.keys(ChartTypeName) },
        },
        dropRandomRows: {
            defaultValue: 0,
            control: { type: "range", min: 0, max: 100 },
        },
    },
}

export default CSF

const bounds = new Bounds(0, 0, 1000, 500)

export const OneMetricOneCountryPerChart = (args: any) => {
    return (
        <svg width={bounds.width} height={bounds.height}>
            <FacetChart
                bounds={bounds}
                chartTypeName={args.chartTypeName}
                manager={{
                    table: SynthesizeGDPTable({
                        entityCount: (args.countryCount ?? 4) || 1,
                    })
                        .selectAll()
                        .dropRandomPercent(args.dropRandomRows),
                    yColumnSlug: "GDP",
                    xColumnSlug: "Population",
                }}
            />
        </svg>
    )
}

export const MultipleMetricsOneCountryPerChart = (args: any) => {
    return (
        <svg width={bounds.width} height={bounds.height}>
            <FacetChart
                bounds={bounds}
                chartTypeName={args.chartTypeName}
                manager={{
                    table: SynthesizeFruitTable({
                        entityCount: (args.countryCount ?? 4) || 1,
                    })
                        .selectAll()
                        .dropRandomPercent(args.dropRandomRows),
                }}
            />
        </svg>
    )
}

export const OneChartPerMetric = (args: any) => {
    const table = SynthesizeGDPTable({
        entityCount: (args.countryCount ?? 2) || 1,
    })
        .selectAll()
        .dropRandomPercent(args.dropRandomRows)
    return (
        <svg width={bounds.width} height={bounds.height}>
            <FacetChart
                bounds={bounds}
                chartTypeName={args.chartTypeName}
                manager={{
                    facetStrategy: FacetStrategy.column,
                    yColumnSlugs: table.numericColumnSlugs,
                    table,
                }}
            />
        </svg>
    )
}
