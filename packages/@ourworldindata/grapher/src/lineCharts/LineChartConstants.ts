import { DualAxis } from "../axis/Axis"
import { ChartManager } from "../chart/ChartManager"
import { CoreValueType, EntityYearHighlight } from "@ourworldindata/types"
import { ChartSeries, RenderChartSeries } from "../chart/ChartInterface"
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
    points: LinePoint[]
}

export interface PlacedLineChartSeries extends LineChartSeries {
    placedPoints: PlacedPoint[]
}

export type RenderLineChartSeries = RenderChartSeries<PlacedLineChartSeries>

export interface LinesProps {
    dualAxis: DualAxis
    series: RenderLineChartSeries[]
    isHoverModeActive: boolean
    hidePoints?: boolean
    lineStrokeWidth?: number
    lineOutlineWidth?: number
    markerRadius?: number
    isStatic?: boolean
    multiColor?: boolean
    backgroundColor?: string
}

export interface LineChartManager extends ChartManager {
    entityYearHighlight?: EntityYearHighlight
    lineStrokeWidth?: number
    canSelectMultipleEntities?: boolean // used to pick an appropriate series name
}
