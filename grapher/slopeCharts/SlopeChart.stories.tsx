import * as React from "react"
import { SlopeChart } from "./SlopeChart"
import { SampleColumnSlugs, SynthesizeGDPTable } from "coreTable/OwidTable"

export default {
    title: "SlopeChart",
    component: SlopeChart,
}

const table = SynthesizeGDPTable({ entityCount: 10 })

export const Default = () => {
    return (
        <svg width={600} height={600}>
            <SlopeChart manager={{ table }} />
        </svg>
    )
}

export const WithColorColumn = () => {
    return (
        <svg width={600} height={600}>
            <SlopeChart
                manager={{
                    table,
                    colorColumnSlug: SampleColumnSlugs.Population,
                    yColumnSlug: SampleColumnSlugs.GDP,
                }}
            />
        </svg>
    )
}
