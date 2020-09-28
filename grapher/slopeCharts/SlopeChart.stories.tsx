import * as React from "react"
import { SlopeChart } from "./SlopeChart"
import { SynthesizeGDPTable } from "coreTable/OwidTable"
import { ChartManager } from "grapher/chart/ChartManager"

export default {
    title: "SlopeChart",
    component: SlopeChart,
}

export const Default = () => {
    const table = SynthesizeGDPTable({
        timeRange: [1950, 2010],
    })

    const manager: ChartManager = {
        table,
        yColumnSlug: "GDP",
    }

    return (
        <svg width={640} height={480}>
            <SlopeChart manager={manager} />
        </svg>
    )
}
