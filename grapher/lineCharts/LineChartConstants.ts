import { DualAxis } from "grapher/axis/Axis"
import { ChartOptionsProvider } from "grapher/chart/ChartOptionsProvider"
import { Color, LineName } from "grapher/core/GrapherConstants"
import { PointVector } from "grapher/utils/PointVector"

interface LinePoint {
    x: number
    y: number
}

export interface LineChartMark {
    lineName: LineName
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
    focusedLineNames: LineName[]
    onHover: (hoverX: number | undefined) => void
    hidePoints?: boolean
    lineStrokeWidth?: number
}

export interface LineChartOptionsProvider extends ChartOptionsProvider {
    hidePoints?: boolean
    lineStrokeWidth?: number
}
