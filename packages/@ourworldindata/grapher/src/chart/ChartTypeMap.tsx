import { match, P } from "ts-pattern"
import {
    GRAPHER_CHART_TYPES,
    GRAPHER_MAP_TYPE,
    GrapherChartOrMapType,
    GrapherVariant,
} from "@ourworldindata/types"
import { ChartInterface, ChartState } from "./ChartInterface"
import { ChartManager } from "./ChartManager"
import { ComponentClass, Component } from "react"
import { Bounds } from "@ourworldindata/utils"

import { LineChartState } from "../lineCharts/LineChartState.js"
import { SlopeChartState } from "../slopeCharts/SlopeChartState"
import { DiscreteBarChartState } from "../barCharts/DiscreteBarChartState.js"
import { StackedAreaChartState } from "../stackedCharts/StackedAreaChartState.js"
import { StackedBarChartState } from "../stackedCharts/StackedBarChartState.js"
import { StackedDiscreteBarChartState } from "../stackedCharts/StackedDiscreteBarChartState"
import { ScatterPlotChartState } from "../scatterCharts/ScatterPlotChartState"
import { MarimekkoChartState } from "../stackedCharts/MarimekkoChartState"
import { MapChartState } from "../mapCharts/MapChartState"

import { LineChart } from "../lineCharts/LineChart"
import { SlopeChart } from "../slopeCharts/SlopeChart.js"
import { DiscreteBarChart } from "../barCharts/DiscreteBarChart.js"
import { StackedAreaChart } from "../stackedCharts/StackedAreaChart"
import { StackedBarChart } from "../stackedCharts/StackedBarChart"
import { StackedDiscreteBarChart } from "../stackedCharts/StackedDiscreteBarChart"
import { ScatterPlotChart } from "../scatterCharts/ScatterPlotChart"
import { MarimekkoChart } from "../stackedCharts/MarimekkoChart"
import { MapChart } from "../mapCharts/MapChart"

import { LineChartThumbnail } from "../lineCharts/LineChartThumbnail"
import { SlopeChartThumbnail } from "../slopeCharts/SlopeChartThumbnail"
import { DiscreteBarChartThumbnail } from "../barCharts/DiscreteBarChartThumbnail.js"
import { StackedAreaChartThumbnail } from "../stackedCharts/StackedAreaChartThumbnail"
import { StackedBarChartThumbnail } from "../stackedCharts/StackedBarChartThumbnail"
import { StackedDiscreteBarChartThumbnail } from "../stackedCharts/StackedDiscreteBarChartThumbnail"
import { ScatterPlotChartThumbnail } from "../scatterCharts/ScatterPlotChartThumbnail"
import { MarimekkoChartThumbnail } from "../stackedCharts/MarimekkoChartThumbnail"
import { MapChartThumbnail } from "../mapCharts/MapChartThumbnail"

export interface ChartComponentProps<TState extends ChartState = ChartState> {
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
    chartState?: ChartState
    variant?: GrapherVariant
} & Omit<ChartComponentProps, "chartState">

const ChartComponentClassMap = new Map<
    GrapherChartOrMapType,
    ChartComponentClass<any>
>([
    [GRAPHER_CHART_TYPES.LineChart, LineChart],
    [GRAPHER_CHART_TYPES.SlopeChart, SlopeChart],
    [GRAPHER_CHART_TYPES.DiscreteBar, DiscreteBarChart],
    [GRAPHER_CHART_TYPES.StackedArea, StackedAreaChart],
    [GRAPHER_CHART_TYPES.StackedBar, StackedBarChart],
    [GRAPHER_CHART_TYPES.StackedDiscreteBar, StackedDiscreteBarChart],
    [GRAPHER_CHART_TYPES.ScatterPlot, ScatterPlotChart],
    [GRAPHER_CHART_TYPES.Marimekko, MarimekkoChart],
    [GRAPHER_MAP_TYPE, MapChart],
])

const ChartThumbnailClassMap = new Map<
    GrapherChartOrMapType,
    ChartComponentClass<any>
>([
    [GRAPHER_CHART_TYPES.LineChart, LineChartThumbnail],
    [GRAPHER_CHART_TYPES.SlopeChart, SlopeChartThumbnail],
    [GRAPHER_CHART_TYPES.DiscreteBar, DiscreteBarChartThumbnail],
    [GRAPHER_CHART_TYPES.StackedArea, StackedAreaChartThumbnail],
    [GRAPHER_CHART_TYPES.StackedBar, StackedBarChartThumbnail],
    [GRAPHER_CHART_TYPES.StackedDiscreteBar, StackedDiscreteBarChartThumbnail],
    [GRAPHER_CHART_TYPES.ScatterPlot, ScatterPlotChartThumbnail],
    [GRAPHER_CHART_TYPES.Marimekko, MarimekkoChartThumbnail],
    [GRAPHER_MAP_TYPE, MapChartThumbnail],
])

const ChartStateMap = new Map<
    GrapherChartOrMapType,
    new (args: { manager: ChartManager }) => ChartState
>([
    [GRAPHER_CHART_TYPES.LineChart, LineChartState],
    [GRAPHER_CHART_TYPES.SlopeChart, SlopeChartState],
    [GRAPHER_CHART_TYPES.DiscreteBar, DiscreteBarChartState],
    [GRAPHER_CHART_TYPES.StackedArea, StackedAreaChartState],
    [GRAPHER_CHART_TYPES.StackedBar, StackedBarChartState],
    [GRAPHER_CHART_TYPES.StackedDiscreteBar, StackedDiscreteBarChartState],
    [GRAPHER_CHART_TYPES.ScatterPlot, ScatterPlotChartState],
    [GRAPHER_CHART_TYPES.Marimekko, MarimekkoChartState],
    [GRAPHER_MAP_TYPE, MapChartState],
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
    variant = GrapherVariant.Default
): ChartComponentClass {
    const { ClassMap, DefaultChartClass } = match(variant)
        .with(GrapherVariant.Default, () => ({
            ClassMap: ChartComponentClassMap,
            DefaultChartClass: LineChart,
        }))
        .with(
            P.union(GrapherVariant.Thumbnail, GrapherVariant.MinimalThumbnail),
            () => ({
                ClassMap: ChartThumbnailClassMap,
                DefaultChartClass: LineChartThumbnail,
            })
        )
        .exhaustive()

    const ChartClass = ClassMap.get(chartType) ?? DefaultChartClass

    return ChartClass as ChartComponentClass
}

export const ChartComponent = ({
    manager,
    chartType,
    chartState,
    variant = GrapherVariant.Default,
    ...componentProps
}: ChartFactoryProps): React.ReactElement => {
    const validChartState = chartState ?? makeChartState(chartType, manager)
    const ChartClass = getChartComponentClass(chartType, variant)
    return <ChartClass {...componentProps} chartState={validChartState} />
}

export const makeChartInstance = ({
    manager,
    chartType,
    chartState,
    variant = GrapherVariant.Default,
    ...componentProps
}: ChartFactoryProps): ChartInterface => {
    const validChartState = chartState ?? makeChartState(chartType, manager)
    const ChartClass = getChartComponentClass(chartType, variant)
    return new ChartClass({ ...componentProps, chartState: validChartState })
}
