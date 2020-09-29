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

    return <ScatterPlot manager={manager} />
}
