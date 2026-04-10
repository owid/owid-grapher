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
    fontSize?: number
    legendWidth?: number
    legendMaxWidth?: number
    legendTitle?: string
    legendAlign?: HorizontalAlign
    legendTickSize?: number
    numericBinSize?: number
    resolveLegendBinEmphasis?: (bin: ColorScaleBin) => Emphasis
    legendStyleConfig?: LegendStyleConfig
    numericLegendStyleConfig?: LegendStyleConfig
}

export interface HorizontalCategoricalColorLegendOptions {
    fontSize?: number
    legendWidth?: number
    legendMaxWidth?: number
    legendAlign?: HorizontalAlign
    resolveLegendBinEmphasis?: (bin: ColorScaleBin) => Emphasis
    legendStyleConfig?: LegendStyleConfig
    categoricalLegendStyleConfig?: LegendStyleConfig
}

export type HorizontalColorLegend =
    | { kind: "numeric"; state: HorizontalNumericColorLegendState }
    | { kind: "categorical"; state: HorizontalCategoricalColorLegendState }

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
