import { CoreColumn } from "@ourworldindata/core-table"
import { ChartSeries } from "../chart/ChartInterface"
import { ChartManager } from "../chart/ChartManager"
import { ScaleType } from "@ourworldindata/types"
import { Bounds } from "@ourworldindata/utils"

export interface SlopeChartValue {
    x: number
    y: number
}

export interface SlopeChartSeries extends ChartSeries {
    size: number
    values: SlopeChartValue[]
    annotation?: string
}

export const DEFAULT_SLOPE_CHART_COLOR = "#ff7f0e"

export interface SlopeEntryProps extends ChartSeries {
    x1: number
    y1: number
    x2: number
    y2: number

    isLayerMode: boolean
    isHovered: boolean
}

export interface LabelledSlopesProps {
    manager: ChartManager
    formatColumn: CoreColumn
    bounds: Bounds
    seriesArr: SlopeChartSeries[]
    hoverKey?: string
    onMouseOver: (slopeProps: SlopeEntryProps) => void
    onMouseLeave: () => void
    onClick?: () => void
    isPortrait: boolean
}

export interface SlopeAxisProps {
    bounds: Bounds
    orient: "left" | "right"
    column: CoreColumn
    scale: any
    scaleType: ScaleType
    fontSize: number
}
