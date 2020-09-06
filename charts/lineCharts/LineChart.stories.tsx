import * as React from "react"
import "site/client/owid.scss"
import "charts/core/grapher.scss"
import { LineChart } from "charts/lineCharts/LineChart"
import { basicGdpGrapher } from "charts/test/samples"

export default {
    title: "LineChart",
    component: LineChart
}

export const Default = () => {
    const chartConfig = basicGdpGrapher()
    chartConfig.hideEntityControls = true

    return (
        <svg width={640} height={480}>
            <LineChart chart={chartConfig} />
        </svg>
    )
}
