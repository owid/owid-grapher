import { DualAxis } from "../axis/Axis"
import { ChartManager } from "../chart/ChartManager"
import { SeriesName } from "../core/GrapherConstants"
import { TimeBound } from "../../clientUtils/TimeBounds"
import { ChartSeries } from "../chart/ChartInterface"
import { CoreValueType } from "../../coreTable/CoreTableConstants"
import { Color } from "../../clientUtils/owidTypes"

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
    onHover: (hoverX: number | undefined) => void
    hidePoints?: boolean
    lineStrokeWidth?: number
}

export interface LineChartManager extends ChartManager {
    hidePoints?: boolean
    lineStrokeWidth?: number
    startHandleTimeBound?: TimeBound
    canSelectMultipleEntities?: boolean
}
