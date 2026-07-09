import { TextWrap } from "@ourworldindata/components"
import { Color, SeriesName } from "@ourworldindata/types"
import { Bounds, Point } from "@ourworldindata/utils"
import { Emphasis } from "../interaction/Emphasis.js"

export interface InitialAnchoredLabelSeries {
    seriesName: SeriesName
    value: number
    label: string
    position: Point
    color: Color
    emphasis?: Emphasis
}

export interface SizedAnchoredLabelSeries extends InitialAnchoredLabelSeries {
    textPosition: Point
    textWrap: TextWrap
    bounds: Bounds
}

export type PlacedAnchoredLabelSeries = SizedAnchoredLabelSeries
