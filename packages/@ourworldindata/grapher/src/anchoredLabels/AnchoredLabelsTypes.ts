import { TextWrap } from "@ourworldindata/components"
import { Color, SeriesName } from "@ourworldindata/types"
import { Bounds, Point } from "@ourworldindata/utils"

export interface InitialAnchoredLabelSeries {
    seriesName: SeriesName
    value: number
    label: string
    position: Point
    color: Color
}

export interface SizedAnchoredLabelSeries extends InitialAnchoredLabelSeries {
    textPosition: Point
    textWrap: TextWrap
    bounds: Bounds
}

export type PlacedAnchoredLabelSeries = SizedAnchoredLabelSeries
