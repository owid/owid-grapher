import { ScatterPlot } from "grapher/scatterCharts/ScatterPlot"
import { SlopeChart } from "grapher/slopeCharts/SlopeChart"
import { TimeScatter } from "grapher/scatterCharts/TimeScatter"
import { LineChart } from "grapher/lineCharts/LineChart"
import { StackedAreaChart } from "grapher/areaCharts/StackedAreaChart"
import { DiscreteBarChart } from "grapher/barCharts/DiscreteBarChart"
import { StackedBarChart } from "grapher/barCharts/StackedBarChart"
import { ChartTypeName } from "grapher/core/GrapherConstants"

export const getChartComponent = (type: ChartTypeName) => {
    if (type === "DiscreteBar") return DiscreteBarChart
    if (type === "LineChart") return LineChart
    if (type === "SlopeChart") return SlopeChart
    if (type === "StackedArea") return StackedAreaChart
    if (type === "StackedBar") return StackedBarChart
    if (type === "ScatterPlot") return ScatterPlot
    if (type === "TimeScatter") return TimeScatter
    return null
}
