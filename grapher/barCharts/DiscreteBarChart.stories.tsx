import * as React from "react"
import { DiscreteBarChart } from "./DiscreteBarChart"
import { SynthesizeOwidTable } from "coreTable/OwidTable"
import { DiscreteBarChartManager } from "./DiscreteBarChartConstants"

export default {
    title: "DiscreteBarChart",
    component: DiscreteBarChart,
}

export const Default = () => {
    const table = SynthesizeOwidTable({ timeRange: [2000, 2010] })
    table.selectAll()

    const manager: DiscreteBarChartManager = {
        table,
        yColumnSlug: "Population",
    }

    return (
        <svg width={640} height={480}>
            <DiscreteBarChart manager={manager} />
        </svg>
    )
}
