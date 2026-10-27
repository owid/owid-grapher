import { ChartManager } from "../chart/ChartManager"
import { ChartSeries } from "../chart/ChartInterface"
import { Color, EntityName, SortBy, Time } from "@ourworldindata/types"
import { SeriesLabelState } from "../seriesLabel/SeriesLabelState"
import { FontSettings } from "../core/GrapherConstants"

export const ROW_SPACING_FACTOR = 0.35
export const ENTITY_LABEL_CHART_GAP = 8
export const PADDING_BETWEEN_LEGEND_AND_ROWS = 8
export const MAX_ROW_HEIGHT = 54
export const MAX_HEIGHT_PER_SERIES = MAX_ROW_HEIGHT / (1 - ROW_SPACING_FACTOR)
export const SEGMENT_LABEL_PADDING = 8
export const SEGMENT_CROP_TAPER_RATIO = 0.4

export type SwimlaneChartManager = ChartManager

export interface SwimlaneObservation {
    time: Time
    category: string
}

interface SwimlaneSegmentRange {
    startTime: Time
    endTime: Time
}

interface RawSwimlaneCategorySegment extends SwimlaneSegmentRange {
    kind: "category"
    category: string
}

interface RawSwimlaneMissingSegment extends SwimlaneSegmentRange {
    kind: "missing"
}

export type RawSwimlaneSegment =
    | RawSwimlaneCategorySegment
    | RawSwimlaneMissingSegment

interface SwimlaneSegmentVisibleRange {
    /** Start of the part inside the timeline window */
    visibleStartTime: Time
    /** End of the part inside the timeline window */
    visibleEndTime: Time
}

interface SwimlaneCategorySegment
    extends RawSwimlaneCategorySegment, SwimlaneSegmentVisibleRange {
    color: Color
    categoryLabel: string
    timeRangeLabel: string
}

interface SwimlaneMissingSegment
    extends RawSwimlaneMissingSegment, SwimlaneSegmentVisibleRange {
    timeRangeLabel: string
}

export type SwimlaneSegment = SwimlaneCategorySegment | SwimlaneMissingSegment

export interface SwimlaneSegmentPlacement {
    x: number
    width: number
    y: number
    height: number
}

export interface SwimlaneSegmentCrop {
    isStartCropped: boolean
    isEndCropped: boolean
    cropTaper: number
}

export interface SwimlaneSegmentLabelStyle {
    category: FontSettings
    timeRange: FontSettings
}

export interface PlacedSwimlaneSegmentLabel {
    x: number
    y: number
    style: SwimlaneSegmentLabelStyle
}

export type PlacedSwimlaneCategorySegment = SwimlaneCategorySegment &
    SwimlaneSegmentPlacement &
    SwimlaneSegmentCrop & { label?: PlacedSwimlaneSegmentLabel }

export type PlacedSwimlaneSegment =
    | PlacedSwimlaneCategorySegment
    | (SwimlaneMissingSegment & SwimlaneSegmentPlacement)

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
