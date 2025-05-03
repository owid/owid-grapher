import { ScatterPlotChart } from "../scatterCharts/ScatterPlotChart"
import { SlopeChart } from "../slopeCharts/SlopeChart"
import { LineChart } from "../lineCharts/LineChart"
import { StackedAreaChart } from "../stackedCharts/StackedAreaChart"
import { DiscreteBarChart } from "../barCharts/DiscreteBarChart"
import { StackedBarChart } from "../stackedCharts/StackedBarChart"
import { GrapherChartOrMapType, GRAPHER_MAP_TYPE } from "@ourworldindata/types"
import { MapChart } from "../mapCharts/MapChart"
import { ChartInterface } from "./ChartInterface"
import { ChartManager } from "./ChartManager"
import { ComponentClass, Component } from "react"
import { Bounds } from "@ourworldindata/utils"
import { StackedDiscreteBarChart } from "../stackedCharts/StackedDiscreteBarChart"
import { MarimekkoChart } from "../stackedCharts/MarimekkoChart"

interface ChartComponentProps {
    manager: ChartManager
    bounds?: Bounds
    containerElement?: HTMLDivElement
}

interface ChartComponentClass extends ComponentClass<ChartComponentProps> {
    new (props: ChartComponentProps): Component & ChartInterface
}

export const ChartComponentClassMap = new Map<
    GrapherChartOrMapType,
    ChartComponentClass
>([
    ["DiscreteBar", DiscreteBarChart],
    ["LineChart", LineChart],
    ["SlopeChart", SlopeChart],
    ["StackedArea", StackedAreaChart],
    ["StackedBar", StackedBarChart],
    ["StackedDiscreteBar", StackedDiscreteBarChart],
    ["ScatterPlot", ScatterPlotChart],
    ["Marimekko", MarimekkoChart],
    [GRAPHER_MAP_TYPE, MapChart],
])

export const DefaultChartClass = LineChart as ChartComponentClass
export const defaultChartType = "LineChart"
