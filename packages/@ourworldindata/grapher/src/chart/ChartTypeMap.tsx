import { ScatterPlotChart } from "../scatterCharts/ScatterPlotChart"
import { SlopeChart } from "../slopeCharts/SlopeChart"
import { LineChart } from "../lineCharts/LineChart"
import { StackedAreaChart } from "../stackedCharts/StackedAreaChart"
import { DiscreteBarChart } from "../barCharts/DiscreteBarChart"
import { StackedBarChart } from "../stackedCharts/StackedBarChart"
import { GrapherChartOrMapType } from "@ourworldindata/types"
import { MapChart } from "../mapCharts/MapChart"
import { ChartInterface } from "./ChartInterface"
import { ChartManager } from "./ChartManager"
import { ComponentClass, Component } from "react"
import { Bounds } from "@ourworldindata/utils"
import { StackedDiscreteBarChart } from "../stackedCharts/StackedDiscreteBarChart"
import { MarimekkoChart } from "../stackedCharts/MarimekkoChart"
import { match } from "ts-pattern"

interface ChartComponentProps {
    manager: ChartManager
    bounds?: Bounds
    containerElement?: HTMLDivElement
}

interface ChartComponentClass extends ComponentClass<ChartComponentProps> {
    new (props: ChartComponentProps): Component & ChartInterface
}

export const getChartComponentClass = (
    chartOrMapType: GrapherChartOrMapType
): ChartComponentClass => {
    return match(chartOrMapType)
        .returnType<ChartComponentClass>()
        .with("DiscreteBar", () => DiscreteBarChart)
        .with("LineChart", () => LineChart)
        .with("Marimekko", () => MarimekkoChart)
        .with("ScatterPlot", () => ScatterPlotChart)
        .with("SlopeChart", () => SlopeChart)
        .with("StackedArea", () => StackedAreaChart)
        .with("StackedBar", () => StackedBarChart)
        .with("StackedDiscreteBar", () => StackedDiscreteBarChart)
        .with("WorldMap", () => MapChart)
        .exhaustive()
}
