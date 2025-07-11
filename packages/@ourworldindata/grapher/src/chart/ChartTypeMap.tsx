import { match } from "ts-pattern"
import {
    GRAPHER_CHART_TYPES,
    GrapherChartOrMapType,
    GrapherRenderMode,
} from "@ourworldindata/types"
import { ChartInterface, ChartState } from "./ChartInterface"
import { ChartManager } from "./ChartManager"
import { ComponentClass, Component } from "react"
import { Bounds } from "@ourworldindata/utils"

import { LineChartState } from "../lineCharts/LineChartState.js"
import { LineChart } from "../lineCharts/LineChart"
import { LineChartThumbnail } from "../lineCharts/LineChartThumbnail"

interface ChartComponentProps<TState extends ChartState = ChartState> {
    chartState: TState
    bounds?: Bounds
}

interface ChartComponentClass<T extends ChartState = ChartState>
    extends ComponentClass<ChartComponentProps<T>> {
    new (props: ChartComponentProps<T>): Component & ChartInterface
}

type ChartFactoryProps = {
    manager: ChartManager
    chartType: GrapherChartOrMapType
    renderMode?: GrapherRenderMode
} & Omit<ChartComponentProps, "chartState">

const ChartComponentClassMap = new Map<
    GrapherChartOrMapType,
    ChartComponentClass<any>
>([
    [GRAPHER_CHART_TYPES.LineChart, LineChart],
    // [GRAPHER_CHART_TYPES.DiscreteBar, DiscreteBarChart],
    // [GRAPHER_CHART_TYPES.SlopeChart, SlopeChart],
    // [GRAPHER_CHART_TYPES.StackedArea, StackedAreaChart],
    // [GRAPHER_CHART_TYPES.StackedBar, StackedBarChart],
    // [GRAPHER_CHART_TYPES.StackedDiscreteBar, StackedDiscreteBarChart],
    // [GRAPHER_CHART_TYPES.ScatterPlot, ScatterPlotChart],
    // [GRAPHER_CHART_TYPES.Marimekko, MarimekkoChart],
    // [GRAPHER_MAP_TYPE, MapChart],
])

const ChartThumbnailClassMap = new Map<
    GrapherChartOrMapType,
    ChartComponentClass<any>
>([
    [GRAPHER_CHART_TYPES.LineChart, LineChartThumbnail],
    // [GRAPHER_CHART_TYPES.DiscreteBar, DiscreteBarChart],
    // [GRAPHER_CHART_TYPES.SlopeChart, SlopeChart],
    // [GRAPHER_CHART_TYPES.StackedArea, StackedAreaChart],
    // [GRAPHER_CHART_TYPES.StackedBar, StackedBarChart],
    // [GRAPHER_CHART_TYPES.StackedDiscreteBar, StackedDiscreteBarChart],
    // [GRAPHER_CHART_TYPES.ScatterPlot, ScatterPlotChart],
    // [GRAPHER_CHART_TYPES.Marimekko, MarimekkoChart],
    // [GRAPHER_MAP_TYPE, MapChart],
])

const ChartStateMap = new Map<
    GrapherChartOrMapType,
    new (args: { manager: ChartManager }) => ChartState
>([
    [GRAPHER_CHART_TYPES.LineChart, LineChartState],
    // [GRAPHER_CHART_TYPES.DiscreteBar, DiscreteBarChart],
    // [GRAPHER_CHART_TYPES.SlopeChart, SlopeChart],
    // [GRAPHER_CHART_TYPES.StackedArea, StackedAreaChart],
    // [GRAPHER_CHART_TYPES.StackedBar, StackedBarChart],
    // [GRAPHER_CHART_TYPES.StackedDiscreteBar, StackedDiscreteBarChart],
    // [GRAPHER_CHART_TYPES.ScatterPlot, ScatterPlotChart],
    // [GRAPHER_CHART_TYPES.Marimekko, MarimekkoChart],
    // [GRAPHER_MAP_TYPE, MapChart],
])

export function makeChartState(
    chartType: GrapherChartOrMapType,
    manager: ChartManager
): ChartState {
    const StateClass = ChartStateMap.get(chartType) ?? LineChartState
    return new StateClass({ manager })
}

function getChartComponentClass(
    chartType: GrapherChartOrMapType,
    renderMode = GrapherRenderMode.Captioned
): ChartComponentClass {
    const { ClassMap, DefaultChartClass } = match(renderMode)
        .with(GrapherRenderMode.Captioned, () => ({
            ClassMap: ChartComponentClassMap,
            DefaultChartClass: LineChart,
        }))
        .with(GrapherRenderMode.Thumbnail, () => ({
            ClassMap: ChartThumbnailClassMap,
            DefaultChartClass: LineChartThumbnail,
        }))
        .exhaustive()

    const ChartClass = ClassMap.get(chartType) ?? DefaultChartClass

    return ChartClass as ChartComponentClass
}

export const ChartComponent = ({
    manager,
    chartType,
    renderMode = GrapherRenderMode.Captioned,
    ...chartComponentProps
}: ChartFactoryProps): React.ReactElement => {
    const chartState = makeChartState(chartType, manager)
    const ChartClass = getChartComponentClass(chartType, renderMode)
    return <ChartClass {...chartComponentProps} chartState={chartState} />
}

export const makeChartInstance = ({
    manager,
    chartType,
    renderMode = GrapherRenderMode.Captioned,
    ...chartComponentProps
}: ChartFactoryProps): ChartInterface => {
    const chartState = makeChartState(chartType, manager)
    const ChartClass = getChartComponentClass(chartType, renderMode)
    return new ChartClass({ ...chartComponentProps, chartState })
}
