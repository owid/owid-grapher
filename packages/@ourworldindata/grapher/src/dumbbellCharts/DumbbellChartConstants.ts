import { ChartManager } from "../chart/ChartManager"
import { ChartSeries } from "../chart/ChartInterface"
import { InteractionState } from "../interaction/InteractionState"
import { Emphasis } from "../interaction/Emphasis"
import { ColumnSlug, EntityName } from "@ourworldindata/types"
import { TextWrap } from "@ourworldindata/components"
import { SeriesLabelState } from "../seriesLabel/SeriesLabelState"
import {
    GRAPHER_AREA_OPACITY_DEFAULT,
    GRAPHER_AREA_OPACITY_HIGHLIGHTED,
    GRAPHER_AREA_OPACITY_MUTED,
} from "../core/GrapherConstants"

export type DumbbellChartManager = ChartManager

export interface DumbbellEndpoint {
    value: number
    time: number
    columnSlug: ColumnSlug
}

// --- Discriminated union: data series vs no-data series ---

interface DumbbellSeriesBase extends ChartSeries {
    entityName: EntityName
    displayName: string
    shortEntityName?: string
    annotation?: string
}

export interface DumbbellDataSeries extends DumbbellSeriesBase {
    type: "data"
    start: DumbbellEndpoint
    end: DumbbellEndpoint
    startColor: string
    endColor: string
    connectorColor: string
    focus: InteractionState
}

export interface DumbbellNoDataSeries extends DumbbellSeriesBase {
    type: "no-data"
}

export type DumbbellChartSeries = DumbbellDataSeries | DumbbellNoDataSeries

// --- Sized (after label measurement) ---

export type SizedDumbbellChartSeries = (
    | DumbbellDataSeries
    | DumbbellNoDataSeries
) & {
    label: SeriesLabelState
    annotationTextWrap?: TextWrap
}

// --- Placed (with pixel coordinates) ---

interface PlacedSeriesBase {
    barY: number
    entityLabelX: number
    entityLabelY: number
    annotationY?: number
}

export type PlacedDumbbellDataSeries = DumbbellDataSeries &
    PlacedSeriesBase & {
        label: SeriesLabelState
        annotationTextWrap?: TextWrap
        startX: number
        endX: number
    }

export type PlacedDumbbellNoDataSeries = DumbbellNoDataSeries &
    PlacedSeriesBase & {
        label: SeriesLabelState
        annotationTextWrap?: TextWrap
    }

export type PlacedDumbbellChartSeries =
    | PlacedDumbbellDataSeries
    | PlacedDumbbellNoDataSeries

// --- Render (with emphasis) ---

export type RenderDumbbellDataSeries = PlacedDumbbellDataSeries & {
    emphasis: Emphasis
}

export type RenderDumbbellNoDataSeries = PlacedDumbbellNoDataSeries & {
    emphasis: Emphasis
}

export type RenderDumbbellChartSeries =
    | RenderDumbbellDataSeries
    | RenderDumbbellNoDataSeries

// --- Styles ---

interface DumbbellStyle {
    opacity: number
    labelOpacity: number
}

export const DUMBBELL_STYLE: Record<Emphasis, DumbbellStyle> = {
    [Emphasis.Default]: {
        opacity: GRAPHER_AREA_OPACITY_DEFAULT,
        labelOpacity: 1,
    },
    [Emphasis.Highlighted]: {
        opacity: GRAPHER_AREA_OPACITY_HIGHLIGHTED,
        labelOpacity: 1,
    },
    [Emphasis.Muted]: {
        opacity: GRAPHER_AREA_OPACITY_MUTED,
        labelOpacity: 0.3,
    },
}

export type DumbbellMode = "two-column" | "time-range"

export const BAR_SPACING_FACTOR = 0.35
