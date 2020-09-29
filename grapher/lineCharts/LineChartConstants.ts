import { DualAxis } from "grapher/axis/Axis"
import { ChartManager } from "grapher/chart/ChartManager"
import { Color, SeriesName } from "grapher/core/GrapherConstants"
import { PointVector } from "grapher/utils/PointVector"

interface LinePoint {
    x: number
    y: number
}

export interface LineChartMark {
    seriesName: SeriesName
    color: Color
    isProjection?: boolean
    points: LinePoint[]
}

export interface PlacedLineChartMark extends LineChartMark {
    placedPoints: PointVector[]
}

export interface LinesProps {
    dualAxis: DualAxis
    placedMarks: PlacedLineChartMark[]
    focusedSeriesNames: SeriesName[]
    onHover: (hoverX: number | undefined) => void
    hidePoints?: boolean
    lineStrokeWidth?: number
}

export interface LineChartManager extends ChartManager {
    hidePoints?: boolean
    lineStrokeWidth?: number
}
