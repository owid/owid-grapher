import { ScatterPlotChart } from "grapher/scatterCharts/ScatterPlotChart"
import { TimeScatterChart } from "grapher/scatterCharts/TimeScatterChart"
import { SlopeChart } from "grapher/slopeCharts/SlopeChart"
import { LineChart } from "grapher/lineCharts/LineChart"
import { StackedAreaChart } from "grapher/stackedCharts/StackedAreaChart"
import { DiscreteBarChart } from "grapher/barCharts/DiscreteBarChart"
import { StackedBarChart } from "grapher/stackedCharts/StackedBarChart"
import { ChartTypeName } from "grapher/core/GrapherConstants"
import { MapChart } from "grapher/mapCharts/MapChart"

export const getChartComponent = (type: ChartTypeName) => {
    if (type === ChartTypeName.DiscreteBar) return DiscreteBarChart
    if (type === ChartTypeName.LineChart) return LineChart
    if (type === ChartTypeName.SlopeChart) return SlopeChart
    if (type === ChartTypeName.StackedArea) return StackedAreaChart
    if (type === ChartTypeName.StackedBar) return StackedBarChart
    if (type === ChartTypeName.ScatterPlot) return ScatterPlotChart
    if (type === ChartTypeName.TimeScatter) return TimeScatterChart
    if (type === ChartTypeName.WorldMap) return MapChart
    return null
}
