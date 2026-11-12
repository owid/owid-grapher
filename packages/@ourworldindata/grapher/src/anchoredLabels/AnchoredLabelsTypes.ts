import { Color, SeriesName } from "@ourworldindata/types"
import { Bounds, Point } from "@ourworldindata/utils"
import { Emphasis } from "../interaction/Emphasis.js"
import { SeriesLabelState } from "../seriesLabel/SeriesLabelState.js"

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
    seriesLabel: SeriesLabelState
    bounds: Bounds
}

export type PlacedAnchoredLabelSeries = SizedAnchoredLabelSeries
