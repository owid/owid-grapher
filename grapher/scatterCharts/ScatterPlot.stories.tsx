import { SynthesizeOwidTable } from "owidTable/OwidTable"
import * as React from "react"
import { ScatterPlot } from "./ScatterPlot"

export default {
    title: "ScatterPlot",
    component: ScatterPlot,
}

export const Default = () => {
    const table = SynthesizeOwidTable()
    const options = { table, yColumns: [table.get("GDP")!] }

    table.selectAll()

    return (
        <svg width={640} height={480}>
            <ScatterPlot options={options} />
        </svg>
    )
}
