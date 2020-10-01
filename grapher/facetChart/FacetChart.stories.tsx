import * as React from "react"
import { FacetChart } from "./FacetChart"
import { SynthesizeGDPTable } from "coreTable/OwidTable"
import { Bounds } from "grapher/utils/Bounds"
import { FacetStrategy } from "grapher/core/GrapherConstants"

export default {
    title: "FacetChart",
    component: FacetChart,
    argTypes: {
        chartTypeName: { control: "select", defaultValue: "LineChart" },
        countryCount: {
            control: { type: "range", defaultValue: 4, min: 1, max: 200 },
        },
    },
}

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
                    }).selectAll(),
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
                    table: SynthesizeGDPTable({
                        entityCount: (args.countryCount ?? 4) || 1,
                    }).selectAll(),
                }}
            />
        </svg>
    )
}

export const OneChartPerMetric = (args: any) => {
    const table = SynthesizeGDPTable({
        entityCount: (args.countryCount ?? 2) || 1,
    }).selectAll()
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
