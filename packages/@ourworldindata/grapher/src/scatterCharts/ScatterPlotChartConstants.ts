import { ScaleLinear } from "d3-scale"
import { Quadtree } from "d3-quadtree"
import {
    Color,
    Time,
    EntityId,
    EntityName,
    OwidTable,
} from "@ourworldindata/core-table"
import { DualAxis } from "../axis/Axis"
import { ChartManager } from "../chart/ChartManager"
import { NoDataModalManager } from "../noDataModal/NoDataModal"
import { ColorScale } from "../color/ColorScale"
import {
    ScatterPointLabelStrategy,
    EntitySelectionMode,
    SeriesName,
    BASE_FONT_SIZE,
} from "../core/GrapherConstants"

import { Bounds, PointVector } from "@ourworldindata/utils"
import { ChartSeries } from "../chart/ChartInterface"

export interface ScatterPlotManager extends ChartManager {
    hideConnectedScatterLines?: boolean
    scatterPointLabelStrategy?: ScatterPointLabelStrategy
    addCountryMode?: EntitySelectionMode
    xOverrideTime?: Time | undefined
    tableAfterAuthorTimelineAndActiveChartTransform?: OwidTable
    includedEntities?: EntityId[]
    excludedEntities?: EntityId[]
    backgroundSeriesLimit?: number
    hideLinesOutsideTolerance?: boolean
    startTime?: Time
    endTime?: Time
    hasTimeline?: boolean
    hideScatterLabels?: boolean
}

export interface ScatterSeries extends ChartSeries {
    label: string
    points: SeriesPoint[]
    isScaleColor?: boolean
}

export interface SeriesPoint {
    x: number
    y: number
    size?: number
    entityName?: EntityName
    label: string
    color?: number | Color
    timeValue: Time
    time: {
        x: number
        y: number
        span?: [number, number]
    }
}

export interface ScatterRenderPoint {
    position: PointVector
    color: Color
    size: number
    label: string
    time: {
        x: number
        y: number
    }
}

export const SCATTER_POINT_MIN_RADIUS: number = 2 // only enforced in rendered points, not in scale
export const SCATTER_POINT_MAX_RADIUS: number = 18
export const SCATTER_POINT_OPACITY: number = 0.8
export const SCATTER_POINT_STROKE_WIDTH: number = 0.5
export const SCATTER_POINT_DEFAULT_RADIUS: number = 3
export const SCATTER_LINE_MIN_WIDTH: number = 0.5 // only enforced in rendered lines, not in scale
export const SCATTER_LINE_MAX_WIDTH: number = 2
export const SCATTER_LINE_DEFAULT_WIDTH: number = 1
export const SCATTER_LABEL_MIN_FONT_SIZE_FACTOR: number = 10 / BASE_FONT_SIZE
export const SCATTER_LABEL_MAX_FONT_SIZE_FACTOR: number = 13 / BASE_FONT_SIZE
export const SCATTER_LABEL_DEFAULT_FONT_SIZE_FACTOR: number =
    10.5 / BASE_FONT_SIZE
export const SCATTER_LABEL_FONT_SIZE_FACTOR_WHEN_HIDDEN_LINES: number =
    12 / BASE_FONT_SIZE

export interface ScatterRenderSeries extends ChartSeries {
    displayKey: string
    size: number
    fontSize: number
    points: ScatterRenderPoint[]
    text: string
    isHover?: boolean
    isTooltip?: boolean
    isFocus?: boolean
    isForeground?: boolean
    offsetVector: PointVector
    startLabel?: ScatterLabel
    midLabels: ScatterLabel[]
    endLabel?: ScatterLabel
    allLabels: ScatterLabel[]
}

export interface ScatterLabel {
    text: string
    fontSize: number
    fontWeight: number
    color: Color
    bounds: Bounds
    series: ScatterRenderSeries
    isHidden?: boolean
    isStart?: boolean
    isMid?: boolean
    isEnd?: boolean
}

export interface ScatterPointsWithLabelsProps {
    seriesArray: ScatterSeries[]
    hoveredSeriesNames: SeriesName[]
    focusedSeriesNames: SeriesName[]
    tooltipSeriesName?: SeriesName
    dualAxis: DualAxis
    colorScale?: ColorScale
    sizeScale: ScaleLinear<number, number>
    fontScale: ScaleLinear<number, number>
    baseFontSize: number
    onMouseEnter: (series: ScatterSeries) => void
    onMouseLeave: () => void
    onClick: () => void
    isConnected: boolean
    hideConnectedScatterLines: boolean
    noDataModalManager: NoDataModalManager
    disableIntroAnimation?: boolean
    hideScatterLabels?: boolean
    quadtree: Quadtree<ScatterPointQuadtreeNode>
}

export const SCATTER_QUADTREE_SAMPLING_DISTANCE = 10
export const SCATTER_POINT_HOVER_TARGET_RANGE = 20

export interface ScatterPointQuadtreeNode {
    series: ScatterSeries
    x: number
    y: number
}
