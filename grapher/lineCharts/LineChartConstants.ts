import { DualAxis } from "grapher/axis/Axis"
import { ChartManager } from "grapher/chart/ChartManager"
import { SeriesName } from "grapher/core/GrapherConstants"
import { PointVector } from "clientUtils/PointVector"
import { TimeBound } from "clientUtils/TimeBounds"
import { ChartSeries } from "grapher/chart/ChartInterface"

interface LinePoint {
    x: number
    y: number
}

export interface LineChartSeries extends ChartSeries {
    isProjection?: boolean
    points: LinePoint[]
}

export interface PlacedLineChartSeries extends LineChartSeries {
    placedPoints: PointVector[]
}

export interface LinesProps {
    dualAxis: DualAxis
    placedSeries: PlacedLineChartSeries[]
    focusedSeriesNames: SeriesName[]
    onHover: (hoverX: number | undefined) => void
    hidePoints?: boolean
    lineStrokeWidth?: number
}

export interface LineChartManager extends ChartManager {
    hidePoints?: boolean
    lineStrokeWidth?: number
    startHandleTimeBound?: TimeBound
}
