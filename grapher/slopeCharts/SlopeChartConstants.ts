import { CoreColumn } from "../../coreTable/CoreTableColumns"
import { ChartSeries } from "../chart/ChartInterface"
import { ChartManager } from "../chart/ChartManager"
import { ScaleType } from "../core/GrapherConstants"
import { TextWrap } from "../text/TextWrap"
import { Bounds } from "../../clientUtils/Bounds"

export interface SlopeChartValue {
    readonly x: number
    readonly y: number
}

export interface SlopeChartSeries extends ChartSeries {
    readonly size: number
    readonly values: readonly SlopeChartValue[]
}

export const DEFAULT_SLOPE_CHART_COLOR = "#ff7f0e"

export interface SlopeProps extends ChartSeries {
    readonly isLayerMode: boolean
    readonly x1: number
    readonly y1: number
    readonly x2: number
    readonly y2: number
    readonly size: number
    readonly hasLeftLabel: boolean
    readonly hasRightLabel: boolean
    readonly labelFontSize: number
    readonly leftLabelBounds: Bounds
    readonly rightLabelBounds: Bounds
    readonly leftValueStr: string
    readonly rightValueStr: string
    readonly leftLabel: TextWrap
    readonly rightLabel: TextWrap
    readonly isFocused: boolean
    readonly isHovered: boolean
    readonly leftValueWidth: number
    readonly rightValueWidth: number
}

export interface LabelledSlopesProps {
    readonly manager: ChartManager
    readonly yColumn: CoreColumn
    readonly bounds: Bounds
    readonly seriesArr: readonly SlopeChartSeries[]
    readonly focusKeys: readonly string[]
    readonly hoverKeys: readonly string[]
    readonly onMouseOver: (slopeProps: SlopeProps) => void
    readonly onMouseLeave: () => void
    readonly onClick: () => void
}

export interface SlopeAxisProps {
    readonly bounds: Bounds
    readonly orient: "left" | "right"
    readonly column: CoreColumn
    readonly scale: any
    readonly scaleType: ScaleType
}
