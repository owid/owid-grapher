import * as React from "react"
import { SlopeChart } from "./SlopeChart"
import { Bounds } from "grapher/utils/Bounds"
import { SynthesizeOwidTable } from "owidTable/OwidTable"
import { SlopeChartOptionsProvider } from "./SlopeChartOptionsProvider"

export default {
    title: "SlopeChart",
    component: SlopeChart,
}

export const Default = () => {
    const table = SynthesizeOwidTable({
        timeRange: [1950, 2010],
    })

    const options: SlopeChartOptionsProvider = {
        table,
        yColumn: table.get("GDP"),
    }

    return (
        <svg width={640} height={480}>
            <SlopeChart options={options} bounds={new Bounds(0, 0, 800, 400)} />
        </svg>
    )
}
