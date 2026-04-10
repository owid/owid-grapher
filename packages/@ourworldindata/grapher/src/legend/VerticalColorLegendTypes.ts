import { TextWrap } from "@ourworldindata/components"
import { ColorScaleBin } from "../color/ColorScaleBin"
import { LegendStyleConfig } from "./LegendStyleConfig"
import { Emphasis } from "../interaction/Emphasis"

export interface SizedLegendSeries {
    bin: ColorScaleBin
    textWrap: TextWrap
    width: number
    height: number
    yOffset: number
}

export interface VerticalColorLegendOptions {
    maxLegendWidth?: number
    fontSize?: number
    legendTitle?: string
    resolveLegendBinEmphasis?: (bin: ColorScaleBin) => Emphasis
    legendStyleConfig?: LegendStyleConfig
    categoricalLegendStyleConfig?: LegendStyleConfig
}
