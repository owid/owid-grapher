import * as React from "react"
import { LineChart } from "grapher/lineCharts/LineChart"
import { SynthesizeGDPTable } from "coreTable/OwidTable"

export default {
    title: "LineChart",
    component: LineChart,
}

export const Default = () => {
    const table = SynthesizeGDPTable({
        timeRange: [2000, 2010],
        countryCount: 5,
    })
    const manager = { table, yColumnSlugs: ["GDP"] }
    table.selectAll()

    return (
        <svg width={640} height={480}>
            <LineChart manager={manager} />
        </svg>
    )
}
