import { TextWrap } from "@ourworldindata/components"
import { Bounds, Point } from "@ourworldindata/utils"
import { ColorScaleBin } from "../color/ColorScaleBin"

export interface SizedLegendSeries {
    bin: ColorScaleBin
    textWrap: TextWrap
    width: number
    height: number
}

export interface PlacedLegendSeries extends SizedLegendSeries {
    /** Where the label's text wrap is anchored. */
    label: Point
    swatch: Bounds
    /** Covers the swatch and its label, so either one responds to the pointer. */
    hitArea: Bounds
}

export interface VerticalColorLegendOptions {
    fontSize?: number
    maxWidth?: number
    title?: string
}
