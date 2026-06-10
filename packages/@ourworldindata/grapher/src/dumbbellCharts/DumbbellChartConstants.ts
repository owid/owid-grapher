import { ChartManager } from "../chart/ChartManager"
import { ChartSeries } from "../chart/ChartInterface"
import { InteractionState } from "../interaction/InteractionState"
import { Emphasis } from "../interaction/Emphasis"
import {
    DumbbellTrendColorMap,
    EntityName,
    SortBy,
} from "@ourworldindata/types"
import { TextWrap } from "@ourworldindata/components"
import { SeriesLabelState } from "../seriesLabel/SeriesLabelState"
import { GRAPHER_OPACITY_MUTED } from "../core/GrapherConstants.js"
import {
    GRAPHER_DARK_TEXT,
    GRAPHER_DENIM,
    GRAPHER_LIGHT_TEXT,
    OWID_NO_DATA_GRAY,
} from "../color/ColorConstants.js"
import { BinaryMapPaletteF } from "../color/CustomSchemes.js"

/** Horizontal gap between the value label and the dumbbell */
export const VALUE_LABEL_DOT_GAP = 6

/** Horizontal gap between entity labels and the chart area */
export const ENTITY_LABEL_CHART_GAP = 8

/** Vertical gap between the top legend and the chart area */
export const TOP_LEGEND_BOTTOM_PADDING = 4

/** Minimum horizontal gap between legend labels */
export const MIN_LEGEND_LABEL_GAP = 8

export const NO_CHANGE_COLOR = OWID_NO_DATA_GRAY

export const DEFAULT_DUMBBELL_TREND_COLOR_MAP = {
    increase: BinaryMapPaletteF.colorSets[0][0],
    decrease: BinaryMapPaletteF.colorSets[0][1],
} satisfies DumbbellTrendColorMap

export const START_COLUMN_COLOR = GRAPHER_DENIM
export const END_COLUMN_COLOR = "#B13507"

/**
 * A dumbbell always plots one row per entity. What its two ends compare
 * depends on the mode:
 * - TimeRange: one column's values across two time points
 * - TwoColumn: two different columns' values at a single time point
 */
export enum DumbbellMode {
    TimeRange = "TimeRange",
    TwoColumn = "TwoColumn",
}

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
    labelColor: string
}

const DEFAULT_DUMBBELL_STYLE: DumbbellStyle = {
    opacity: 1,
    labelColor: GRAPHER_LIGHT_TEXT,
}

export const DUMBBELL_STYLE: Record<Emphasis, DumbbellStyle> = {
    [Emphasis.Default]: DEFAULT_DUMBBELL_STYLE,
    [Emphasis.Elevated]: DEFAULT_DUMBBELL_STYLE,
    [Emphasis.Highlighted]: {
        ...DEFAULT_DUMBBELL_STYLE,
        labelColor: GRAPHER_DARK_TEXT,
    },
    [Emphasis.Muted]: {
        ...DEFAULT_DUMBBELL_STYLE,
        opacity: GRAPHER_OPACITY_MUTED,
    },
}

export interface LegendLabel {
    text: string
    color: string
    textAnchor: "center" | "outward"
}

export const DUMBBELL_SORT_KEYS = [
    SortBy.custom,
    SortBy.entityName,
    SortBy.total,
    SortBy.column,
    SortBy.change,
    SortBy.startValue,
    SortBy.endValue,
] as const
export type DumbbellSortKey = (typeof DUMBBELL_SORT_KEYS)[number]
