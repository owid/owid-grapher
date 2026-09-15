import { ChartManager } from "../chart/ChartManager"
import { ChartSeries } from "../chart/ChartInterface"
import { Color, EntityName, SortBy, Time } from "@ourworldindata/types"
import { SeriesLabelState } from "../seriesLabel/SeriesLabelState"

export const LANE_SPACING_FACTOR = 0.35
export const ENTITY_LABEL_CHART_GAP = 8
export const TICK_LABEL_OVERFLOW_PADDING = 2
export const MIN_SEGMENT_WIDTH = 1
export const PADDING_BETWEEN_LEGEND_AND_LANES = 8

export type SwimlaneChartManager = ChartManager

export interface SwimlaneObservation {
    time: Time
    category: string
}

interface SwimlaneSegmentRange {
    startTime: Time
    endTime: Time
}

export interface SwimlaneCategorySegment extends SwimlaneSegmentRange {
    kind: "category"
    category: string
}

export interface SwimlaneMissingSegment extends SwimlaneSegmentRange {
    kind: "missing"
}

export type SwimlaneSegment = SwimlaneCategorySegment | SwimlaneMissingSegment

export type ColoredSwimlaneCategorySegment = SwimlaneCategorySegment & {
    color: Color
}

export type ColoredSwimlaneSegment =
    | ColoredSwimlaneCategorySegment
    | SwimlaneMissingSegment

export type PlacedSwimlaneSegment = ColoredSwimlaneSegment & {
    x: number
    width: number
    y: number
    height: number
}

export interface SwimlaneSeries extends ChartSeries {
    seriesName: EntityName
    entityName: EntityName
    shortEntityName?: string
    segments: ColoredSwimlaneSegment[]
}

export interface SizedSwimlaneSeries extends SwimlaneSeries {
    label: SeriesLabelState
}

export interface PlacedSwimlaneSeries extends SizedSwimlaneSeries {
    y: number
    labelPosition: { x: number; yOffset: number }
    placedSegments: PlacedSwimlaneSegment[]
}

export interface OrdinalSwimlaneCategories {
    kind: "ordinal"
    values: string[]
}

export interface CategoricalSwimlaneCategories {
    kind: "categorical"
    values: string[]
}

export type SwimlaneCategories =
    | OrdinalSwimlaneCategories
    | CategoricalSwimlaneCategories

export const SWIMLANE_SORT_KEYS = [
    SortBy.custom,
    SortBy.entityName,
    SortBy.firstCategory,
    SortBy.lastCategory,
] as const
export type SwimlaneSortKey = (typeof SWIMLANE_SORT_KEYS)[number]

export function isSwimlaneSortKey(sortBy: SortBy): sortBy is SwimlaneSortKey {
    return (SWIMLANE_SORT_KEYS as readonly SortBy[]).includes(sortBy)
}
