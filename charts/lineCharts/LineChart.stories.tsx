import * as React from "react"
import "site/client/owid.scss"
import "charts/core/chart.scss"
import { LineChart } from "charts/lineCharts/LineChart"
import { basicGdpChart } from "charts/test/samples"

export default {
    title: "LineChart",
    component: LineChart
}

export const Default = () => {
    const chartConfig = basicGdpChart()
    chartConfig.hideEntityControls = true

    return (
        <svg width={640} height={480}>
            <LineChart options={chartConfig} />
        </svg>
    )
}
