import { ScatterPlotChart } from "../scatterCharts/ScatterPlotChart.js"
import { TimeScatterChart } from "../scatterCharts/TimeScatterChart.js"
import { SlopeChart } from "../slopeCharts/SlopeChart.js"
import { LineChart } from "../lineCharts/LineChart.js"
import { StackedAreaChart } from "../stackedCharts/StackedAreaChart.js"
import { DiscreteBarChart } from "../barCharts/DiscreteBarChart.js"
import { StackedBarChart } from "../stackedCharts/StackedBarChart.js"
import { ChartTypeName } from "../core/GrapherConstants.js"
import { MapChart } from "../mapCharts/MapChart.js"
import { ChartInterface } from "./ChartInterface.js"
import { ChartManager } from "./ChartManager.js"
import { ComponentClass, Component } from "react"
import { Bounds } from "@ourworldindata/utils"
import { StackedDiscreteBarChart } from "../stackedCharts/StackedDiscreteBarChart.js"
import { MarimekkoChart } from "../stackedCharts/MarimekkoChart.js"

interface ChartComponentProps {
    manager: ChartManager
    bounds?: Bounds
    containerElement?: any // todo: remove?
}

interface ChartComponentClass extends ComponentClass<ChartComponentProps> {
    new (props: ChartComponentProps): Component & ChartInterface
}

export const ChartComponentClassMap = new Map<
    ChartTypeName,
    ChartComponentClass
>([
    [ChartTypeName.DiscreteBar, DiscreteBarChart],
    [ChartTypeName.LineChart, LineChart],
    [ChartTypeName.SlopeChart, SlopeChart],
    [ChartTypeName.StackedArea, StackedAreaChart],
    [ChartTypeName.StackedBar, StackedBarChart],
    [ChartTypeName.StackedDiscreteBar, StackedDiscreteBarChart],
    [ChartTypeName.ScatterPlot, ScatterPlotChart],
    [ChartTypeName.Marimekko, MarimekkoChart],
    [ChartTypeName.TimeScatter, TimeScatterChart],
    [ChartTypeName.WorldMap, MapChart],
])

export const DefaultChartClass = LineChart as ChartComponentClass
