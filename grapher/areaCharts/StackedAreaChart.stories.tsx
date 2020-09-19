import { ChartOptionsProvider } from "grapher/chart/ChartOptionsProvider"
import { SynthesizeOwidTable } from "owidTable/OwidTable"
import * as React from "react"
import { StackedAreaChart } from "./StackedAreaChart"

export default {
    title: "StackedAreaChart",
    component: StackedAreaChart,
}

export const Default = () => {
    const table = SynthesizeOwidTable({
        timeRange: [1950, 2010],
    })

    table.selectAll()

    const options: ChartOptionsProvider = {
        table,
        yColumns: [table.get("GDP")!],
    }

    return (
        <svg width={640} height={480}>
            <StackedAreaChart options={options} />
        </svg>
    )
}
