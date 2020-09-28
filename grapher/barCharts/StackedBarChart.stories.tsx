import * as React from "react"
import { ChartManager } from "grapher/chart/ChartManager"
import { StackedBarChart } from "./StackedBarChart"
import { SynthesizeOwidTable } from "coreTable/OwidTable"

export default {
    title: "StackedBarChart",
    component: StackedBarChart,
}

export const Default = () => {
    const table = SynthesizeOwidTable({ timeRange: [2000, 2010] })
    table.selectAll()

    const manager: ChartManager = {
        table,
        yColumnSlugs: ["Population"],
    }

    return (
        <svg width={640} height={480}>
            <StackedBarChart manager={manager} />
        </svg>
    )
}
