import { ChartManager } from "../chart/ChartManager"
import { ChartSeries } from "../chart/ChartInterface"
import { InteractionState } from "../interaction/InteractionState"
import { Emphasis } from "../interaction/Emphasis"
import { EntityName } from "@ourworldindata/types"
import { TextWrap } from "@ourworldindata/components"
import { SeriesLabelState } from "../seriesLabel/SeriesLabelState"
import { GRAPHER_OPACITY_MUTED } from "../core/GrapherConstants.js"
import { GRAPHER_DENIM, GRAY_50 } from "../color/ColorConstants.js"

/** Horizontal gap between the value label and the dumbbell */
export const VALUE_LABEL_DOT_GAP = 4

/** Horizontal gap between entity labels and the chart area */
export const ENTITY_LABEL_CHART_GAP = 8

// Min and max radius for the dumbbell heads
export const MIN_DUMBBELL_HEAD_RADIUS = 2
export const MAX_DUMBBELL_HEAD_RADIUS = 6

export const INCREASE_COLOR = "#00875E"
export const DECREASE_COLOR = "#D73C50"

export const START_COLUMN_COLOR = GRAPHER_DENIM
export const END_COLUMN_COLOR = "#B13507"

export const DEFAULT_CONNECTOR_COLOR = GRAY_50

export type DumbbellChartManager = ChartManager

export interface DumbbellSeries extends ChartSeries {
    entityName: EntityName
    displayName: string
    shortEntityName?: string
    annotation?: string
    left: DumbbellHead
    right: DumbbellHead
    connector: {
        direction: "right" | "left" | "none"
        color: string
    }
    focus: InteractionState
}

export interface SizedDumbbellSeries extends DumbbellSeries {
    label: SeriesLabelState
    annotationTextWrap?: TextWrap
    left: SizedDumbbellHead
    right: SizedDumbbellHead
}

export interface PlacedDumbbellSeries extends SizedDumbbellSeries {
    y: number
    labelPosition: { x: number; yOffset: number }
    annotationPosition?: { x: number; yOffset: number }
    left: PlacedDumbbellHead
    right: PlacedDumbbellHead
}

export interface RenderDumbbellSeries extends PlacedDumbbellSeries {
    emphasis: Emphasis
}

export interface DumbbellHead {
    type: "start" | "end"
    value: number
    time: number
    color: string
}

interface SizedDumbbellHead extends DumbbellHead {
    label: { text: string; width: number; padding: number }
    radius: number
}

export interface PlacedDumbbellHead extends SizedDumbbellHead {
    x: number
}

interface DumbbellStyle {
    opacity: number
}

const DEFAULT_DUMBBELL_STYLE: DumbbellStyle = { opacity: 1 }

export const DUMBBELL_STYLE: Record<Emphasis, DumbbellStyle> = {
    [Emphasis.Default]: DEFAULT_DUMBBELL_STYLE,
    [Emphasis.Elevated]: DEFAULT_DUMBBELL_STYLE,
    [Emphasis.Highlighted]: DEFAULT_DUMBBELL_STYLE,
    [Emphasis.Muted]: { opacity: GRAPHER_OPACITY_MUTED },
}
