import * as React from "react"
import "site/client/owid.scss"
import "charts/core/chart.scss"
import { DiscreteBarChart } from "./DiscreteBarChart"
import { basicGdpChart } from "charts/test/samples"
import { ChartView } from "charts/core/ChartView"
import { Bounds } from "charts/utils/Bounds"

export default {
    title: "DiscreteBarChart",
    component: DiscreteBarChart
}

export const Default = () => {
    const chart = basicGdpChart()
    const bounds = new Bounds(0, 0, 640, 480)
    const chartView = new ChartView({ chart, bounds })

    return (
        <svg width={640} height={480}>
            <DiscreteBarChart
                chart={chart}
                chartView={chartView}
                bounds={bounds}
            />
        </svg>
    )
}
