import { CoreColumn } from "coreTable/CoreTableColumns"
import { EntityName } from "coreTable/CoreTableConstants"
import { DualAxis } from "grapher/axis/Axis"
import { ChartManager } from "grapher/chart/ChartManager"
import { NoDataModalManager } from "grapher/noDataModal/NoDataModal"
import { ColorScale } from "grapher/color/ColorScale"
import {
    ScatterPointLabelStrategy,
    EntitySelectionMode,
    SeriesName,
    Color,
    Time,
} from "grapher/core/GrapherConstants"
import { Bounds } from "grapher/utils/Bounds"
import { PointVector } from "grapher/utils/PointVector"

export interface ScatterPlotManager extends ChartManager {
    hideConnectedScatterLines?: boolean
    scatterPointLabelStrategy?: ScatterPointLabelStrategy
    addCountryMode?: EntitySelectionMode
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

export type SeriesPointMap = Map<SeriesName, Map<Time, SeriesPoint>>

export interface ScatterSeries {
    color: Color
    seriesName: SeriesName
    label: string
    size: number
    points: SeriesPoint[]
    isScaleColor?: true
}

export interface SeriesPoint {
    x: number
    y: number
    size: number
    entityName?: EntityName
    label: string
    color?: number | string
    timeValue: Time
    time: {
        x: number
        y: number
        span?: [number, number]
    }
}

export interface ScatterRenderPoint {
    position: PointVector
    color: string
    size: number
    fontSize: number
    label: string
    time: {
        x: number
        y: number
    }
}

export const ScatterLabelFontFamily = "Arial, sans-serif"

export interface ScatterRenderSeries {
    seriesName: SeriesName
    displayKey: string
    color: string
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
    color: string
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
