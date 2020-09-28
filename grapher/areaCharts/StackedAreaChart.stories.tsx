import { ChartManager } from "grapher/chart/ChartManager"
import { SynthesizeOwidTable } from "coreTable/OwidTable"
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

    const manager: ChartManager = {
        table,
        yColumnSlugs: ["GDP"],
    }

    return (
        <svg width={640} height={480}>
            <StackedAreaChart manager={manager} />
        </svg>
    )
}
