import { ScatterPlotChart } from "../scatterCharts/ScatterPlotChart"
import { TimeScatterChart } from "../scatterCharts/TimeScatterChart"
import { SlopeChart } from "../slopeCharts/SlopeChart"
import { LineChart } from "../lineCharts/LineChart"
import { StackedAreaChart } from "../stackedCharts/StackedAreaChart"
import { DiscreteBarChart } from "../barCharts/DiscreteBarChart"
import { StackedBarChart } from "../stackedCharts/StackedBarChart"
import { ChartTypeName } from "../core/GrapherConstants"
import { MapChart } from "../mapCharts/MapChart"
import { ChartInterface } from "./ChartInterface"
import { ChartManager } from "./ChartManager"
import { ComponentClass, Component } from "react"
import { Bounds } from "../../clientUtils/Bounds"
import { StackedDiscreteBarChart } from "../stackedCharts/StackedDiscreteBarChart"

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
    [ChartTypeName.TimeScatter, TimeScatterChart],
    [ChartTypeName.WorldMap, MapChart],
])

export const DefaultChartClass = LineChart as ChartComponentClass
