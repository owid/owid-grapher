import { ChartManager } from "../chart/ChartManager"
import { ChartSeries } from "../chart/ChartInterface"
import {
    AxisConfigInterface,
    Color,
    EntityName,
    SortBy,
    Time,
} from "@ourworldindata/types"
import { SeriesLabelState } from "../seriesLabel/SeriesLabelState"

export const LANE_SPACING_FACTOR = 0.35
export const ENTITY_LABEL_CHART_GAP = 8
export const TICK_LABEL_OVERFLOW_PADDING = 2
export const PADDING_BETWEEN_LEGEND_AND_LANES = 8
export const MAX_LANE_HEIGHT = 36
export const SEGMENT_LABEL_PADDING = 8
/** Length of a cropped segment's point, as a fraction of the segment's height */
export const SEGMENT_CROP_TAPER_RATIO = 0.4
export const SEGMENT_LABEL_TIME_RANGE_FONT_WEIGHT = 500

/** The domain runs one step past the last time, so the last band has room */
export const SWIMLANE_X_AXIS_CONFIG_DEFAULTS: AxisConfigInterface = {
    isDomainEndExclusive: true,
}

export type SwimlaneChartManager = ChartManager

export interface SwimlaneObservation {
    time: Time
    category: string
}

interface SwimlaneSegmentRange {
    startTime: Time
    endTime: Time
    /** Start of the part inside the timeline window */
    visibleStartTime: Time
    /** End of the part inside the timeline window */
    visibleEndTime: Time
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

export type PlacedSwimlaneCategorySegment = Extract<
    PlacedSwimlaneSegment,
    { kind: "category" }
>

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

export const SWIMLANE_SORT_KEYS = [SortBy.custom, SortBy.entityName] as const
export type SwimlaneSortKey = (typeof SWIMLANE_SORT_KEYS)[number]

export function isSwimlaneSortKey(sortBy: SortBy): sortBy is SwimlaneSortKey {
    return (SWIMLANE_SORT_KEYS as readonly SortBy[]).includes(sortBy)
}
