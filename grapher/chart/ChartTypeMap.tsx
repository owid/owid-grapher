import { ScatterPlotChart } from "grapher/scatterCharts/ScatterPlotChart"
import { TimeScatterChart } from "grapher/scatterCharts/TimeScatterChart"
import { SlopeChart } from "grapher/slopeCharts/SlopeChart"
import { LineChart } from "grapher/lineCharts/LineChart"
import { StackedAreaChart } from "grapher/stackedCharts/StackedAreaChart"
import { DiscreteBarChart } from "grapher/barCharts/DiscreteBarChart"
import { StackedBarChart } from "grapher/stackedCharts/StackedBarChart"
import { ChartTypeName } from "grapher/core/GrapherConstants"
import { MapChart } from "grapher/mapCharts/MapChart"
import { ChartInterface } from "./ChartInterface"
import { ChartManager } from "./ChartManager"
import { ComponentClass, Component } from "react"
import { Bounds } from "grapher/utils/Bounds"

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
    [ChartTypeName.ScatterPlot, ScatterPlotChart],
    [ChartTypeName.TimeScatter, TimeScatterChart],
    [ChartTypeName.WorldMap, MapChart],
])
