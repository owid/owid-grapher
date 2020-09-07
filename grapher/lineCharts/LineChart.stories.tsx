import * as React from "react"
import "site/client/owid.scss"
import "grapher/core/grapher.scss"
import { LineChart } from "grapher/lineCharts/LineChart"
import { basicGdpGrapher } from "grapher/test/samples"

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
