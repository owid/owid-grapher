import { SynthesizeGDPTable } from "coreTable/OwidTable"
import * as React from "react"
import { ScatterPlot } from "./ScatterPlot"

export default {
    title: "ScatterPlot",
    component: ScatterPlot,
}

export const Default = () => {
    const table = SynthesizeGDPTable()
    const manager = {
        table,
        yColumnSlugs: ["GDP"],
        xColumnSlug: "Population",
    }

    table.selectAll()

    return (
        <svg width={600} height={600}>
            <ScatterPlot manager={manager} />
        </svg>
    )
}
