import * as React from "react"
import { SlopeChart } from "./SlopeChart"
import { SynthesizeOwidTable } from "owidTable/OwidTable"
import { ChartOptionsProvider } from "grapher/chart/ChartOptionsProvider"

export default {
    title: "SlopeChart",
    component: SlopeChart,
}

export const Default = () => {
    const table = SynthesizeOwidTable({
        timeRange: [1950, 2010],
    })

    const options: ChartOptionsProvider = {
        table,
        yColumn: table.get("GDP"),
    }

    return (
        <svg width={640} height={480}>
            <SlopeChart options={options} />
        </svg>
    )
}
