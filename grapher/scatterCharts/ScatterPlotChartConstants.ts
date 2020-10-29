import { CoreColumn } from "coreTable/CoreTableColumns"
import { Color, Time } from "coreTable/CoreTableConstants"
import { DualAxis } from "grapher/axis/Axis"
import { ChartManager } from "grapher/chart/ChartManager"
import { NoDataModalManager } from "grapher/noDataModal/NoDataModal"
import { ColorScale } from "grapher/color/ColorScale"
import {
    ScatterPointLabelStrategy,
    EntitySelectionMode,
    SeriesName,
} from "grapher/core/GrapherConstants"

import { Bounds } from "grapher/utils/Bounds"
import { PointVector } from "grapher/utils/PointVector"
import { EntityName } from "coreTable/OwidTableConstants"
import { ChartSeries } from "grapher/chart/ChartInterface"

export interface ScatterPlotManager extends ChartManager {
    hideConnectedScatterLines?: boolean
    scatterPointLabelStrategy?: ScatterPointLabelStrategy
    addCountryMode?: EntitySelectionMode
    xOverrideTime?: Time | undefined
}

export interface ScatterTooltipProps {
    yColumn: CoreColumn
    xColumn: CoreColumn
    series: ScatterSeries
    maxWidth: number
    fontSize: number
    x: number
    y: number
}

export interface ScatterSeries extends ChartSeries {
    label: string
    size: number
    points: SeriesPoint[]
    isScaleColor?: boolean
}

export interface SeriesPoint {
    x: number
    y: number
    size: number
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
    fontSize: number
    label: string
    time: {
        x: number
        y: number
    }
}

export const ScatterLabelFontFamily = "Arial, sans-serif"

export interface ScatterRenderSeries extends ChartSeries {
    displayKey: string
    size: number
    points: ScatterRenderPoint[]
    text: string
    isHover?: boolean
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
    dualAxis: DualAxis
    colorScale?: ColorScale
    sizeDomain: [number, number]
    onMouseOver: (series: ScatterSeries) => void
    onMouseLeave: () => void
    onClick: () => void
    hideLines: boolean
    noDataModalManager: NoDataModalManager
}
