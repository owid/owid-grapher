import { ScatterPlot } from "charts/scatterCharts/ScatterPlot"
import { SlopeChart } from "charts/slopeCharts/SlopeChart"
import { TimeScatter } from "charts/scatterCharts/TimeScatter"
import { LineChart } from "charts/lineCharts/LineChart"
import { StackedAreaChart } from "charts/areaCharts/StackedAreaChart"
import { DiscreteBarChart } from "charts/barCharts/DiscreteBarChart"
import { StackedBarChart } from "charts/barCharts/StackedBarChart"

export const ChartTypeMap = {
    SlopeChart,
    LineChart,
    StackedAreaChart,
    StackedBarChart
    // todo: these dont current work:
    //DiscreteBarChart,
    // ScatterPlot,
    //TimeScatter
}

export type ChartTypeName = keyof typeof ChartTypeMap
