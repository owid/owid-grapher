import * as React from "react"
import { DiscreteBarChart } from "./DiscreteBarChart"
import { SynthesizeOwidTable } from "coreTable/OwidTable"
import { DiscreteBarChartOptionsProvider } from "./DiscreteBarChartConstants"

export default {
    title: "DiscreteBarChart",
    component: DiscreteBarChart,
}

export const Default = () => {
    const table = SynthesizeOwidTable({ timeRange: [2000, 2010] })
    table.selectAll()

    const options: DiscreteBarChartOptionsProvider = {
        table,
        yColumnSlug: "Population",
    }

    return (
        <svg width={640} height={480}>
            <DiscreteBarChart options={options} />
        </svg>
    )
}
