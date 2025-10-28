import { DualAxis } from "../axis/Axis"
import { ChartManager } from "../chart/ChartManager"
import { CoreValueType, EntityName, Time } from "@ourworldindata/types"
import { ChartSeries } from "../chart/ChartInterface"
import { Color } from "@ourworldindata/utils"
import { InteractionState } from "../interaction/InteractionState"

export const LINE_CHART_CLASS_NAME = "LineChart"

// line color
export const DEFAULT_LINE_COLOR = "#000"
// stroke width
export const DEFAULT_STROKE_WIDTH = 1.5
export const VARIABLE_COLOR_STROKE_WIDTH = 2.5
// marker radius
export const DEFAULT_MARKER_RADIUS = 1.8
export const VARIABLE_COLOR_MARKER_RADIUS = 2.2
export const DISCONNECTED_DOTS_MARKER_RADIUS = 2.6
export const STATIC_SMALL_MARKER_RADIUS = 3
// line outline
export const DEFAULT_LINE_OUTLINE_WIDTH = 0.5
export const VARIABLE_COLOR_LINE_OUTLINE_WIDTH = 1.0
// legend
export const LEGEND_PADDING = 25

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
    displayName: string
    isProjection?: boolean
    plotMarkersOnly?: boolean
    points: LinePoint[]
    entityName: EntityName
    columnName: string
    focus: InteractionState
}

export interface PlacedLineChartSeries extends LineChartSeries {
    placedPoints: PlacedPoint[]
}

export interface RenderLineChartSeries extends PlacedLineChartSeries {
    hover: InteractionState
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
