import { TextWrap } from "@ourworldindata/components"
import { Color, SeriesName } from "@ourworldindata/types"
import { Bounds } from "@ourworldindata/utils"

export interface InitialSimpleLabelSeries {
    seriesName: SeriesName
    value: number
    label: string
    yPosition: number
    color: Color
}

export interface SizedSimpleLabelSeries extends InitialSimpleLabelSeries {
    textWrap: TextWrap
    bounds: Bounds
}

export type PlacedSimpleLabelSeries = SizedSimpleLabelSeries
