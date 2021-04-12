import { DualAxis } from "../axis/Axis"
import { ChartManager } from "../chart/ChartManager"
import { SeriesName } from "../core/GrapherConstants"
import { PointVector } from "../../clientUtils/PointVector"
import { TimeBound } from "../../clientUtils/TimeBounds"
import { ChartSeries } from "../chart/ChartInterface"

export interface LinePoint {
    readonly x: number
    readonly y: number
}

export interface LineChartSeries extends ChartSeries {
    readonly isProjection?: boolean
    readonly points: readonly LinePoint[]
}

export interface PlacedLineChartSeries extends LineChartSeries {
    readonly placedPoints: readonly PointVector[]
}

export interface LinesProps {
    readonly dualAxis: DualAxis
    readonly placedSeries: readonly PlacedLineChartSeries[]
    readonly focusedSeriesNames: readonly SeriesName[]
    readonly onHover: (hoverX: number | undefined) => void
    readonly hidePoints?: boolean
    readonly lineStrokeWidth?: number
}

export interface LineChartManager extends ChartManager {
    readonly hidePoints?: boolean
    readonly lineStrokeWidth?: number
    readonly startHandleTimeBound?: TimeBound
    readonly canSelectMultipleEntities?: boolean
}
