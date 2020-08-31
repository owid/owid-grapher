import { basicGdpChart } from "charts/test/samples"

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
