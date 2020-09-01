import * as React from "react"
import "site/client/owid.scss"
import "charts/core/chart.scss"
import { StackedAreaChart } from "./StackedAreaChart"
import { basicGdpChart } from "charts/test/samples"
import { Bounds } from "charts/utils/Bounds"

export default {
    title: "StackedAreaChart",
    component: StackedAreaChart
}

export const Default = () => {
    const chart = basicGdpChart()
    const bounds = new Bounds(0, 0, 640, 480)

    return (
        <svg width={640} height={480}>
            <StackedAreaChart chart={chart} bounds={bounds} />
        </svg>
    )
}
