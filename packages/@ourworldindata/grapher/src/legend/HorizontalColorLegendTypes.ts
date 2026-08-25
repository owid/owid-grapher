import { Bounds, HorizontalAlign } from "@ourworldindata/utils"
import { ColorScaleBin, CategoricalBin } from "../color/ColorScaleBin"
import { LegendStyleConfig } from "./LegendStyleConfig"
import { Emphasis } from "../interaction/Emphasis"
import type { HorizontalNumericColorLegendState } from "./HorizontalNumericColorLegendState"
import type { HorizontalCategoricalColorLegendState } from "./HorizontalCategoricalColorLegendState"

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
    resolveBinEmphasis?: (bin: ColorScaleBin) => Emphasis
    styleConfig?: LegendStyleConfig
}

export interface HorizontalCategoricalColorLegendOptions {
    /** The legend always fills this, wrapping its marks onto as many lines as it needs. */
    width: number
    fontSize?: number
    align?: HorizontalAlign
    resolveBinEmphasis?: (bin: ColorScaleBin) => Emphasis
    styleConfig?: LegendStyleConfig
}

/** Which of the two horizontal legends a chart is showing. */
export type HorizontalColorLegend =
    | { kind: "numeric"; state: HorizontalNumericColorLegendState }
    | { kind: "categorical"; state: HorizontalCategoricalColorLegendState }

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
    legendStyleConfig?: LegendStyleConfig
    numericLegendStyleConfig?: LegendStyleConfig
    categoricalLegendStyleConfig?: LegendStyleConfig
}
