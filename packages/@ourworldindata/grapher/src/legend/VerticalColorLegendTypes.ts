import { TextWrap } from "@ourworldindata/components"
import { ColorScaleBin } from "../color/ColorScaleBin"

export interface SizedLegendSeries {
    bin: ColorScaleBin
    textWrap: TextWrap
    width: number
    height: number
    yOffset: number
}

export interface VerticalColorLegendOptions {
    fontSize?: number
    maxWidth?: number
    title?: string
}
