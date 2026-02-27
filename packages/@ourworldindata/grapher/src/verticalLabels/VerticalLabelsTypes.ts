import { TextWrap } from "@ourworldindata/components"
import { SeriesLabelState } from "../seriesLabel/SeriesLabelState.js"
import { Bounds } from "@ourworldindata/utils"
import { ChartSeries } from "../chart/ChartInterface.js"
import { InteractionState } from "../interaction/InteractionState.js"

export interface LabelSeries extends ChartSeries {
    label: string
    yValue: number
    annotation?: string
    formattedValue?: string
    placeFormattedValueInNewLine?: boolean
    yRange?: [number, number]
    hover?: InteractionState
    focus?: InteractionState
}

export interface SizedLabelSeries extends LabelSeries {
    seriesLabel: SeriesLabelState
    annotationTextWrap?: TextWrap
    width: number
    height: number
    fontWeight?: number
}

export interface PlacedLabelSeries extends SizedLabelSeries {
    origBounds: Bounds
    bounds: Bounds
    repositions: number
    level: number
    totalLevels: number
    midY: number
}

export interface RenderLabelSeries extends PlacedLabelSeries {
    labelCoords: { x: number; y: number }
    connectorLineCoords: { startX: number; endX: number }
    opacity: number
}
