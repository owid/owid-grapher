import { ScatterPlot } from "grapher/scatterCharts/ScatterPlot"
import { SlopeChart } from "grapher/slopeCharts/SlopeChart"
import { TimeScatter } from "grapher/scatterCharts/TimeScatter"
import { LineChart } from "grapher/lineCharts/LineChart"
import { StackedAreaChart } from "grapher/areaCharts/StackedAreaChart"
import { DiscreteBarChart } from "grapher/barCharts/DiscreteBarChart"
import { StackedBarChart } from "grapher/barCharts/StackedBarChart"

export const ChartTypeMap = {
    SlopeChart,
    LineChart,
    StackedAreaChart,
    StackedBarChart,
    DiscreteBarChart,
    ScatterPlot,
    TimeScatter
}

export type ChartTypeName = keyof typeof ChartTypeMap
