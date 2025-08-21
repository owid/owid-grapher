import { MarkdownTextWrap, TextWrap } from "@ourworldindata/components"
import { Bounds } from "@ourworldindata/utils"
import { ChartSeries } from "../chart/ChartInterface"
import { InteractionState } from "../interaction/InteractionState"

export interface LineLabelSeries extends ChartSeries {
    label: string
    yValue: number
    annotation?: string
    formattedValue?: string
    placeFormattedValueInNewLine?: boolean
    yRange?: [number, number]
    hover?: InteractionState
    focus?: InteractionState
}

export interface SizedSeries extends LineLabelSeries {
    textWrap: TextWrap | MarkdownTextWrap
    annotationTextWrap?: TextWrap
    width: number
    height: number
    fontWeight?: number
}

export interface PlacedSeries extends SizedSeries {
    origBounds: Bounds
    bounds: Bounds
    repositions: number
    level: number
    totalLevels: number
    midY: number
}
