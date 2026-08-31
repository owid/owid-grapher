import { Bounds, HorizontalAlign } from "@ourworldindata/utils"
import { ColorScaleBin, CategoricalBin } from "../color/ColorScaleBin"
import { BinEmphasis, LegendStyleConfig } from "./LegendStyleConfig"

export interface PositionedBin {
    x: number
    width: number
    bin: ColorScaleBin
}

export interface NumericLabel {
    text: string
    fontSize: number
    bounds: Bounds
    priority?: boolean
    hidden: boolean
    raised: boolean
    bin: ColorScaleBin
}

export interface CategoricalMark {
    x: number
    y: number
    rectSize: number
    width: number
    label: {
        text: string
        bounds: Bounds
        fontSize: number
    }
    bin: CategoricalBin
}

export interface MarkLine {
    totalWidth: number
    marks: CategoricalMark[]
}

export interface HorizontalNumericColorLegendOptions {
    /** The legend shrinks to its ideal width and aligns itself within this. */
    maxWidth: number
    fontSize?: number
    title?: string
    align?: HorizontalAlign
    tickSize?: number
    binSize?: number
}

export interface HorizontalCategoricalColorLegendOptions {
    /** The legend always fills this, wrapping its marks onto as many lines as it needs. */
    width: number
    fontSize?: number
    align?: HorizontalAlign
}

export interface HorizontalColorLegendProps<State> {
    state: State
    x: number
    y: number
    interactive?: boolean
    styleConfig?: LegendStyleConfig
    binEmphasis?: BinEmphasis
    onMouseEnter?: (bin: ColorScaleBin) => void
    onMouseOver?: (bin: ColorScaleBin) => void
    onMouseLeave?: () => void
    onTouchSelect?: (bin: ColorScaleBin) => void
}

/**
 * What a chart publishes so that a faceted view can build one legend shared
 * across its facets. Data only: positioning and interaction stay with whoever
 * renders the legend.
 */
export interface ExternalColorLegendData {
    numericLegendData?: ColorScaleBin[]
    categoricalLegendData?: CategoricalBin[]
    legendTitle?: string
    legendTickSize?: number
    numericBinSize?: number
    numericLegendStyleConfig?: LegendStyleConfig
    categoricalLegendStyleConfig?: LegendStyleConfig
}
