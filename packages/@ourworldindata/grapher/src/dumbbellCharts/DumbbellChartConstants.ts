import { ChartManager } from "../chart/ChartManager"
import { ChartSeries } from "../chart/ChartInterface"
import { InteractionState } from "../interaction/InteractionState"
import { Emphasis } from "../interaction/Emphasis"
import { EntityName } from "@ourworldindata/types"
import { TextWrap } from "@ourworldindata/components"
import { SeriesLabelState } from "../seriesLabel/SeriesLabelState"
import { GRAPHER_OPACITY_MUTED } from "../core/GrapherConstants.js"
import {
    GRAPHER_DENIM,
    OWID_NO_DATA_GRAY,
} from "../color/ColorConstants.js"

/** Horizontal gap between the value label and the dumbbell */
export const VALUE_LABEL_DOT_GAP = 4

/** Horizontal gap between entity labels and the chart area */
export const ENTITY_LABEL_CHART_GAP = 8

export const INCREASE_COLOR = "#00875E"
export const DECREASE_COLOR = "#D73C50"
export const NO_CHANGE_COLOR = OWID_NO_DATA_GRAY

export const START_COLUMN_COLOR = GRAPHER_DENIM
export const END_COLUMN_COLOR = "#B13507"

export type DumbbellChartManager = ChartManager

export interface DumbbellSeries extends ChartSeries {
    entityName: EntityName
    displayName: string
    shortEntityName?: string
    annotation?: string
    start: DumbbellHead
    end: DumbbellHead
    focus: InteractionState
}

export interface SizedDumbbellSeries extends DumbbellSeries {
    label: SeriesLabelState
    annotationTextWrap?: TextWrap
    start: SizedDumbbellHead
    end: SizedDumbbellHead
}

export interface PlacedDumbbellSeries extends SizedDumbbellSeries {
    y: number
    labelPosition: { x: number; yOffset: number }
    annotationPosition?: { x: number; yOffset: number }
    start: PlacedDumbbellHead
    end: PlacedDumbbellHead
}

export interface RenderDumbbellSeries extends PlacedDumbbellSeries {
    emphasis: Emphasis
}

export interface DumbbellHead {
    value: number
    time: number
    color: string
}

export interface DumbbellValueLabel {
    text: string
    width: number
    padding: number
}

interface SizedDumbbellHead extends DumbbellHead {
    label?: DumbbellValueLabel
    radius: number
}

export interface PlacedDumbbellHead extends SizedDumbbellHead {
    x: number
}

export type LabelledDumbbellHead = PlacedDumbbellHead & {
    label: DumbbellValueLabel
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
