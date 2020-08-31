import * as React from "react"
import "site/client/owid.scss"
import "charts/core/chart.scss"
import { ScatterPlot } from "./ScatterPlot"
import { basicGdpChart } from "charts/test/samples"

export default {
    title: "ScatterPlot",
    component: ScatterPlot,
    includeStories: ["Default"] // This allows us to export non-stories as well
}

export const basicScatter = () => {
    const chartRuntime = basicGdpChart()
    const script = chartRuntime.props
    script.type = "ScatterPlot"
    chartRuntime.yAxisOptions.min = 0
    chartRuntime.yAxisOptions.max = 500
    chartRuntime.xAxisOptions.min = 0
    chartRuntime.xAxisOptions.max = 500
    script.dimensions.push({ variableId: 100, property: "x", display: {} })
    return chartRuntime
}

export const Default = () => {
    const chartRuntime = basicScatter()

    return (
        <svg width={640} height={480}>
            <ScatterPlot config={chartRuntime} />
        </svg>
    )
}
