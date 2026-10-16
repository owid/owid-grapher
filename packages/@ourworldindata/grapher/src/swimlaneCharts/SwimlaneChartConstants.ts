import { ChartManager } from "../chart/ChartManager"
import { ChartSeries } from "../chart/ChartInterface"
import {
    Color,
    EntityName,
    SortBy,
    SwimlaneSegmentLabelMode,
    Time,
} from "@ourworldindata/types"
import { CoreColumn } from "@ourworldindata/core-table"
import { SeriesLabelState } from "../seriesLabel/SeriesLabelState"
import { Emphasis } from "../interaction/Emphasis"
import {
    FontSettings,
    GRAPHER_AREA_OPACITY_MUTED,
} from "../core/GrapherConstants"
import { LegendStyleConfig } from "../legend/LegendStyleConfig"

export const ROW_SPACING_FACTOR = 0.35
export const ENTITY_LABEL_CHART_GAP = 8
export const PADDING_BETWEEN_LEGEND_AND_ROWS = 8
export const MAX_ROW_HEIGHT = 36
export const SEGMENT_LABEL_PADDING = 8
export const SEGMENT_CROP_TAPER_RATIO = 0.4
export const SEGMENT_LABEL_TIME_RANGE_FONT_WEIGHT = 500

interface SwimlaneEmphasisStyleConfig {
    opacity: number
}

export const SWIMLANE_ROW_STYLE: Record<Emphasis, SwimlaneEmphasisStyleConfig> =
    {
        [Emphasis.Default]: { opacity: 1 },
        [Emphasis.Elevated]: { opacity: 1 },
        [Emphasis.Highlighted]: { opacity: 1 },
        [Emphasis.Muted]: { opacity: GRAPHER_AREA_OPACITY_MUTED },
    }

export const SWIMLANE_SEGMENT_STYLE: Record<
    Emphasis,
    SwimlaneEmphasisStyleConfig
> = {
    [Emphasis.Default]: { opacity: 1 },
    [Emphasis.Elevated]: { opacity: 1 },
    [Emphasis.Highlighted]: { opacity: 1 },
    [Emphasis.Muted]: { opacity: GRAPHER_AREA_OPACITY_MUTED },
}

/** Only the muted state is styled, so an unhovered legend renders as it does without a config */
export const SWIMLANE_LEGEND_STYLE: LegendStyleConfig = {
    marker: { [Emphasis.Muted]: { opacity: GRAPHER_AREA_OPACITY_MUTED } },
    text: { [Emphasis.Muted]: { opacity: GRAPHER_AREA_OPACITY_MUTED } },
}

export type SwimlaneChartManager = ChartManager

export type TimeColumnFormatter = Pick<
    CoreColumn,
    "formatTime" | "formatTimeShort" | "formatTimeShortEnd"
>

export interface SwimlaneSegmentLabelSettings {
    segmentLabelMode: SwimlaneSegmentLabelMode
    fontSettings: FontSettings
    timeColumn: TimeColumnFormatter
}

export interface SwimlaneVisibleTimeRange {
    startTime: Time
    endTime: Time
    /** One time interval after `endTime` */
    exclusiveEndTime: Time
}

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

export interface SwimlaneCategorySegment extends SwimlaneSegmentRange {
    kind: "category"
    category: string
    color: Color
    categoryLabel: string
}

export interface SwimlaneMissingSegment extends SwimlaneSegmentRange {
    kind: "missing"
}

export type SwimlaneSegment = SwimlaneCategorySegment | SwimlaneMissingSegment

export type PlacedSwimlaneSegment = SwimlaneSegment & {
    x: number
    width: number
    y: number
    height: number
}

export type RenderSwimlaneSegment = PlacedSwimlaneSegment & {
    emphasis: Emphasis
}

export type RenderSwimlaneCategorySegment = Extract<
    RenderSwimlaneSegment,
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
    slotHeight: number
    labelPosition: { x: number; yOffset: number }
    placedSegments: PlacedSwimlaneSegment[]
}

export interface SwimlaneTooltipTarget {
    entityName: EntityName
    segment: SwimlaneSegment
}

export interface RenderSwimlaneSeries extends Omit<
    PlacedSwimlaneSeries,
    "placedSegments"
> {
    emphasis: Emphasis
    placedSegments: RenderSwimlaneSegment[]
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
