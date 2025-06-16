import { DualAxis } from "../axis/Axis"
import { ChartManager } from "../chart/ChartManager"
import { CoreValueType, InteractionState, Time } from "@ourworldindata/types"
import { ChartSeries } from "../chart/ChartInterface"
import { Color } from "@ourworldindata/utils"

export interface LinePoint {
    x: number
    y: number
    colorValue?: CoreValueType
}

export interface PlacedPoint {
    x: number
    y: number
    color: Color
    time: number
}

export interface LineChartSeries extends ChartSeries {
    isProjection?: boolean
    plotMarkersOnly?: boolean
    points: LinePoint[]
}

export interface PlacedLineChartSeries extends LineChartSeries {
    placedPoints: PlacedPoint[]
}

export interface RenderLineChartSeries extends PlacedLineChartSeries {
    hover: InteractionState
    focus: InteractionState
}

export interface LinesProps {
    dualAxis: DualAxis
    series: RenderLineChartSeries[]
    hidePoints?: boolean
    lineStrokeWidth?: number
    lineOutlineWidth?: number
    markerRadius?: number
    isStatic?: boolean
    multiColor?: boolean
    backgroundColor?: string
}

export interface LineChartManager extends ChartManager {
    highlightedTimesInLineChart?: Time[]
    lineStrokeWidth?: number
    canSelectMultipleEntities?: boolean // used to pick an appropriate series name
}
