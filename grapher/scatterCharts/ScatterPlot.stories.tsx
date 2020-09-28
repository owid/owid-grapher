import { SynthesizeOwidTable } from "coreTable/OwidTable"
import * as React from "react"
import { ScatterPlot } from "./ScatterPlot"

export default {
    title: "ScatterPlot",
    component: ScatterPlot,
}

export const Default = () => {
    const table = SynthesizeOwidTable()
    const manager = {
        table,
        yColumnSlugs: ["GDP"],
        xColumnSlug: "Population",
    }

    table.selectAll()

    return (
        <svg width={640} height={480}>
            <ScatterPlot manager={manager} />
        </svg>
    )
}
