import { DualAxis } from "../axis/Axis"
import { ChartManager } from "../chart/ChartManager"
import { CoreValueType, InteractionState, Time } from "@ourworldindata/types"
import { ChartSeries } from "../chart/ChartInterface"
import { Color } from "@ourworldindata/utils"
import { OWID_NON_FOCUSED_GRAY } from "../color/ColorConstants"

export const LINE_CHART_CLASS_NAME = "LineChart"

// line color
export const NON_FOCUSED_LINE_COLOR = OWID_NON_FOCUSED_GRAY
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
