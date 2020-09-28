import { AbstractCoreColumn } from "coreTable/CoreTable"
import { EntityName } from "coreTable/CoreTableConstants"
import { DualAxis } from "grapher/axis/Axis"
import { ChartManager } from "grapher/chart/ChartManager"
import { NoDataOverlayManager } from "grapher/chart/NoDataOverlay"
import { ColorScale } from "grapher/color/ColorScale"
import {
    ScatterPointLabelStrategy,
    EntitySelectionModes,
} from "grapher/core/GrapherConstants"
import { Bounds } from "grapher/utils/Bounds"
import { PointVector } from "grapher/utils/PointVector"

export interface ScatterPlotManager extends ChartManager {
    hideConnectedScatterLines?: boolean
    scatterPointLabelStrategy?: ScatterPointLabelStrategy
    addCountryMode?: EntitySelectionModes
}

export interface ScatterTooltipProps {
    yColumn: AbstractCoreColumn
    xColumn: AbstractCoreColumn
    series: ScatterSeries
    maxWidth: number
    fontSize: number
    x: number
    y: number
}

export interface ScatterSeries {
    color: string
    entityName: string
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
    year: number
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
    entityName: EntityName
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

export interface PointsWithLabelsProps {
    seriesArray: ScatterSeries[]
    hoverKeys: string[]
    focusKeys: string[]
    dualAxis: DualAxis
    colorScale?: ColorScale
    sizeDomain: [number, number]
    onMouseOver: (series: ScatterSeries) => void
    onMouseLeave: () => void
    onClick: () => void
    hideLines: boolean
    noDataOverlayManager: NoDataOverlayManager
}
