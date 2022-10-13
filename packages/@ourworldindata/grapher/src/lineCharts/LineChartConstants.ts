import { DualAxis } from "../axis/Axis"
import { ChartManager } from "../chart/ChartManager"
import { SeriesName } from "../core/GrapherConstants"
import { ChartSeries } from "../chart/ChartInterface"
import { CoreValueType } from "@ourworldindata/core-table"
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
}

export interface LineChartSeries extends ChartSeries {
    isProjection?: boolean
    points: LinePoint[]
}

export interface PlacedLineChartSeries extends LineChartSeries {
    placedPoints: PlacedPoint[]
}

export interface LinesProps {
    dualAxis: DualAxis
    placedSeries: PlacedLineChartSeries[]
    focusedSeriesNames: SeriesName[]
    hidePoints?: boolean
    lineStrokeWidth?: number
    lineOutlineWidth?: number
    markerRadius?: number
}

export interface LineChartManager extends ChartManager {
    lineStrokeWidth?: number
    canSelectMultipleEntities?: boolean
}
