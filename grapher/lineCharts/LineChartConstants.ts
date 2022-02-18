import { DualAxis } from "../axis/Axis.js"
import { ChartManager } from "../chart/ChartManager.js"
import { SeriesName } from "../core/GrapherConstants.js"
import { TimeBound } from "../../clientUtils/TimeBounds.js"
import { ChartSeries } from "../chart/ChartInterface.js"
import { CoreValueType } from "../../coreTable/CoreTableConstants.js"
import { Color } from "../../clientUtils/owidTypes.js"
import { MultiColorPolylineInterpolation } from "../scatterCharts/MultiColorPolyline.js"

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
    lineInterpolation?: MultiColorPolylineInterpolation
    lineStrokeWidth?: number
    lineOutlineWidth?: number
    markerRadius?: number
}

export interface LineChartManager extends ChartManager {
    lineStrokeWidth?: number
    lineInterpolation?: MultiColorPolylineInterpolation
    canSelectMultipleEntities?: boolean
}
