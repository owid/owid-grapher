import * as React from "react"
import { ChartManager } from "grapher/chart/ChartManager"
import { StackedBarChart } from "./StackedBarChart"
import { SynthesizeGDPTable } from "coreTable/OwidTable"

export default {
    title: "StackedBarChart",
    component: StackedBarChart,
}

export const Default = () => {
    const table = SynthesizeGDPTable({ timeRange: [2000, 2010] })
    table.selectAll()

    const manager: ChartManager = {
        table,
        yColumnSlugs: ["Population"],
    }

    return <StackedBarChart manager={manager} />
}
