import { TextWrap } from "@ourworldindata/components"
import { Color, SeriesName } from "@ourworldindata/types"
import { Bounds, Point } from "@ourworldindata/utils"

export interface InitialSimpleLabelSeries {
    seriesName: SeriesName
    value: number
    label: string
    position: Point
    color: Color
}

export interface SizedSimpleLabelSeries extends InitialSimpleLabelSeries {
    textPosition: Point
    textWrap: TextWrap
    bounds: Bounds
}

export type PlacedSimpleLabelSeries = SizedSimpleLabelSeries
