import { ChartManager } from "../chart/ChartManager"
import { ChartSeries } from "../chart/ChartInterface"
import { Color, EntityName, SortBy, Time } from "@ourworldindata/types"
import { SeriesLabelState } from "../seriesLabel/SeriesLabelState"

export const ROW_SPACING_FACTOR = 0.35
export const ENTITY_LABEL_CHART_GAP = 8
export const PADDING_BETWEEN_LEGEND_AND_ROWS = 8
export const MAX_ROW_HEIGHT = 54
export const MAX_HEIGHT_PER_SERIES = MAX_ROW_HEIGHT / (1 - ROW_SPACING_FACTOR)

export type SwimlaneChartManager = ChartManager

export interface SwimlaneObservation {
    time: Time
    category: string
}

interface SwimlaneSegmentRange {
    startTime: Time
    endTime: Time
}

export interface RawSwimlaneCategorySegment extends SwimlaneSegmentRange {
    kind: "category"
    category: string
}

export interface SwimlaneMissingSegment extends SwimlaneSegmentRange {
    kind: "missing"
}

export type RawSwimlaneSegment =
    | RawSwimlaneCategorySegment
    | SwimlaneMissingSegment

export type SwimlaneCategorySegment = RawSwimlaneCategorySegment & {
    color: Color
}

export type SwimlaneSegment = SwimlaneCategorySegment | SwimlaneMissingSegment

export type PlacedSwimlaneSegment = SwimlaneSegment & {
    x: number
    width: number
    y: number
    height: number
}

export interface SwimlaneSeries extends ChartSeries {
    seriesName: EntityName
    entityName: EntityName
    shortEntityName?: string
    segments: SwimlaneSegment[]
}

export interface SizedSwimlaneSeries extends SwimlaneSeries {
    label: SeriesLabelState
}

export interface PlacedSwimlaneSeries extends Omit<
    SizedSwimlaneSeries,
    "segments"
> {
    y: number
    labelPosition: { x: number; yOffset: number }
    placedSegments: PlacedSwimlaneSegment[]
}

export type SwimlaneCategoryKind = "ordinal" | "categorical"

export const SWIMLANE_SORT_KEYS = [SortBy.custom, SortBy.entityName] as const
export type SwimlaneSortKey = (typeof SWIMLANE_SORT_KEYS)[number]

export function isSwimlaneSortKey(sortBy: SortBy): sortBy is SwimlaneSortKey {
    return (SWIMLANE_SORT_KEYS as readonly SortBy[]).includes(sortBy)
}
