import * as React from "react"
import {
    DiscreteBarChart,
    DiscreteBarChartOptionsProvider,
} from "./DiscreteBarChart"
import { SynthesizeOwidTable } from "coreTable/OwidTable"

export default {
    title: "DiscreteBarChart",
    component: DiscreteBarChart,
}

export const Default = () => {
    const table = SynthesizeOwidTable({ timeRange: [2000, 2010] })
    table.selectAll()

    const options: DiscreteBarChartOptionsProvider = {
        table,
        yColumn: table.get("Population"),
    }

    return (
        <svg width={640} height={480}>
            <DiscreteBarChart options={options} />
        </svg>
    )
}
