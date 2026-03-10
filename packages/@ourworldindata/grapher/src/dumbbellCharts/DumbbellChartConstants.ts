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

// --- Series types ---

export interface DumbbellSeries extends ChartSeries {
    entityName: EntityName
    displayName: string
    shortEntityName?: string
    annotation?: string
    missing: boolean
    // Present when missing === false
    start?: DumbbellEndpoint
    end?: DumbbellEndpoint
    startColor?: string
    endColor?: string
    connectorColor?: string
    focus?: InteractionState
}

// --- Sized (after label measurement) ---

export type SizedDumbbellSeries = DumbbellSeries & {
    label: SeriesLabelState
    annotationTextWrap?: TextWrap
}

// --- Placed (with pixel coordinates) ---

export type PlacedDumbbellSeries = SizedDumbbellSeries & {
    barY: number
    entityLabelX: number
    entityLabelY: number
    annotationY?: number
    // Present when missing === false
    startX?: number
    endX?: number
}

// --- Render (with emphasis) ---

export type RenderDumbbellSeries = PlacedDumbbellSeries & {
    emphasis: Emphasis
}

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

export const BAR_SPACING_FACTOR = 0.35
