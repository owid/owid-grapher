import { AbstractCoreColumn } from "coreTable/CoreTable"
import { ChartManager } from "grapher/chart/ChartManager"
import { ScaleType, SeriesName } from "grapher/core/GrapherConstants"
import { TextWrap } from "grapher/text/TextWrap"
import { Bounds } from "grapher/utils/Bounds"

export interface SlopeChartValue {
    x: number
    y: number
}

export interface SlopeChartSeries {
    label: string
    seriesName: SeriesName
    color: string
    size: number
    values: SlopeChartValue[]
}

export interface SlopeProps {
    seriesName: SeriesName
    isLayerMode: boolean
    x1: number
    y1: number
    x2: number
    y2: number
    color: string
    size: number
    hasLeftLabel: boolean
    hasRightLabel: boolean
    labelFontSize: number
    leftLabelBounds: Bounds
    rightLabelBounds: Bounds
    leftValueStr: string
    rightValueStr: string
    leftLabel: TextWrap
    rightLabel: TextWrap
    isFocused: boolean
    isHovered: boolean
    leftValueWidth: number
    rightValueWidth: number
}

export interface LabelledSlopesProps {
    manager: ChartManager
    yColumn: AbstractCoreColumn
    bounds: Bounds
    seriesArr: SlopeChartSeries[]
    focusKeys: string[]
    hoverKeys: string[]
    onMouseOver: (slopeProps: SlopeProps) => void
    onMouseLeave: () => void
    onClick: () => void
}

export interface SlopeAxisProps {
    bounds: Bounds
    orient: "left" | "right"
    column: AbstractCoreColumn
    scale: any
    scaleType: ScaleType
}
