import { ChartManager } from "../chart/ChartManager"
import { ChartSeries } from "../chart/ChartInterface"
import { InteractionState } from "../interaction/InteractionState"
import { Emphasis } from "../interaction/Emphasis"
import { ColumnSlug, EntityName } from "@ourworldindata/types"
import { Point } from "@ourworldindata/utils"
import { TextWrap } from "@ourworldindata/components"
import { SeriesLabelState } from "../seriesLabel/SeriesLabelState"
import {
    GRAPHER_AREA_OPACITY_DEFAULT,
    GRAPHER_AREA_OPACITY_HIGHLIGHTED,
    GRAPHER_AREA_OPACITY_MUTED,
} from "../core/GrapherConstants"

export type DumbbellChartManager = ChartManager

export interface DumbbellHead {
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
    start?: DumbbellHead
    end?: DumbbellHead
    startColor?: string
    endColor?: string
    connectorColor?: string
    focus?: InteractionState
}

// --- Sized (after label measurement) ---

export interface SizedDumbbellSeries extends DumbbellSeries {
    label: SeriesLabelState
    annotationTextWrap?: TextWrap
}

// --- Placed (with pixel coordinates) ---

export interface PlacedDumbbellSeries extends SizedDumbbellSeries {
    y: number
    labelPosition: Point
    annotationPosition?: Point
    // Present when missing === false
    startX?: number
    endX?: number
}

// --- Render (with emphasis) ---

export interface RenderDumbbellSeries extends PlacedDumbbellSeries {
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

export type DumbbellMode = "two-column" | "time-range"

export const BAR_SPACING_FACTOR = 0.35
