import { Quadtree } from "d3-quadtree"
import { OwidTable } from "@ourworldindata/core-table"
import { DualAxis } from "../axis/Axis"
import { ChartManager } from "../chart/ChartManager"
import { NoDataModalManager } from "../noDataModal/NoDataModal"
import {
    ScatterPointLabelStrategy,
    EntitySelectionMode,
    Color,
    Time,
    EntityName,
} from "@ourworldindata/types"
import {
    GRAPHER_FONT_SCALE_10,
    GRAPHER_FONT_SCALE_10_5,
    GRAPHER_FONT_SCALE_12,
    GRAPHER_FONT_SCALE_13,
} from "../core/GrapherConstants"

import { Bounds, PointVector } from "@ourworldindata/utils"
import { ChartSeries } from "../chart/ChartInterface"
import { InteractionState } from "../interaction/InteractionState.js"

export interface ScatterPlotManager extends ChartManager {
    hideConnectedScatterLines?: boolean
    scatterPointLabelStrategy?: ScatterPointLabelStrategy
    addCountryMode?: EntitySelectionMode
    xOverrideTime?: Time | undefined
    tableAfterAuthorTimelineAndActiveChartTransform?: OwidTable
    startTime?: Time
    endTime?: Time
    hasTimeline?: boolean
    hideScatterLabels?: boolean
    isModalOpen?: boolean
    isSingleTimeScatterAnimationActive?: boolean
    animationStartTime?: number
    animationEndTime?: number
}

export interface ScatterSeries extends ChartSeries {
    label: string
    points: SeriesPoint[]
    isScaleColor?: boolean
    focus: InteractionState
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
        // Time span in relative mode for both axes
        // Technically, to be more correct, we should support distinct
        // start and end times for each axis, but for simplicity we use
        // a single span (see getAverageAnnualChangeIndicesByEntity)
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

export const SCATTER_POINT_DEFAULT_COLOR = "#932834" // used when no color dimension is present
export const SCATTER_POINT_MIN_RADIUS: number = 2 // only enforced in rendered points, not in scale
export const SCATTER_POINT_MAX_RADIUS: number = 18
export const SCATTER_POINT_OPACITY: number = 0.8
export const SCATTER_POINT_STROKE_WIDTH: number = 0.5
export const SCATTER_POINT_DEFAULT_RADIUS: number = 3
export const SCATTER_LINE_MIN_WIDTH: number = 0.5 // only enforced in rendered lines, not in scale
export const SCATTER_LINE_MAX_WIDTH: number = 2
export const SCATTER_LINE_DEFAULT_WIDTH: number = 1
export const SCATTER_LABEL_MIN_FONT_SIZE_FACTOR: number = GRAPHER_FONT_SCALE_10
export const SCATTER_LABEL_MAX_FONT_SIZE_FACTOR: number = GRAPHER_FONT_SCALE_13
export const SCATTER_LABEL_DEFAULT_FONT_SIZE_FACTOR: number =
    GRAPHER_FONT_SCALE_10_5
export const SCATTER_LABEL_FONT_SIZE_FACTOR_WHEN_HIDDEN_LINES: number =
    GRAPHER_FONT_SCALE_12

// Positioned series — data mapped to screen coordinates
export interface PlacedScatterSeries extends ChartSeries {
    label: string
    points: ScatterRenderPoint[]
    displayKey: string
    size: number // representative radius (last point)
    fontSize: number
    text: string
    isScaleColor?: boolean
    offsetVector: PointVector
}

// Interaction-state-resolved series — ready for rendering and label placement
export interface RenderScatterSeries extends PlacedScatterSeries {
    isHover: boolean
    isFocus: boolean
    isForeground: boolean
    isTooltip: boolean
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
    series: RenderScatterSeries
    isHidden?: boolean
    isStart?: boolean
    isMid?: boolean
    isEnd?: boolean
}

export interface ScatterPointsWithLabelsProps {
    seriesArray: RenderScatterSeries[]
    isLayerMode: boolean
    dualAxis: DualAxis
    baseFontSize: number
    onMouseEnter?: (seriesName: string) => void
    onMouseLeave?: () => void
    onClick?: () => void
    isConnected: boolean
    hideConnectedScatterLines: boolean
    noDataModalManager: NoDataModalManager
    disableIntroAnimation?: boolean
    hideScatterLabels?: boolean
    hideEntityLabels?: boolean
    quadtree?: Quadtree<ScatterPointQuadtreeNode>
    backgroundColor?: Color
    hideFocusRing?: boolean
}

export const SCATTER_QUADTREE_SAMPLING_DISTANCE = 10
export const SCATTER_POINT_HOVER_TARGET_RANGE = 20

export interface ScatterPointQuadtreeNode {
    series: { seriesName: string }
    x: number
    y: number
}
