import * as React from "react"
import { ChartOptionsProvider } from "grapher/chart/ChartOptionsProvider"
import { StackedBarChart } from "./StackedBarChart"
import { SynthesizeOwidTable } from "coreTable/OwidTable"

export default {
    title: "StackedBarChart",
    component: StackedBarChart,
}

export const Default = () => {
    const table = SynthesizeOwidTable({ timeRange: [2000, 2010] })
    table.selectAll()

    const options: ChartOptionsProvider = {
        table,
        yColumn: table.get("Population"),
    }

    return (
        <svg width={640} height={480}>
            <StackedBarChart options={options} />
        </svg>
    )
}
