import { ChartManager } from "../chart/ChartManager"
import { ChartSeries } from "../chart/ChartInterface"
import { Color, EntityName, Time } from "@ourworldindata/types"
import { SeriesLabelState } from "../seriesLabel/SeriesLabelState"

export const LANE_SPACING_FACTOR = 0.35
export const ENTITY_LABEL_CHART_GAP = 8
export const TICK_LABEL_OVERFLOW_PADDING = 2
export const MIN_SEGMENT_WIDTH = 1

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

export type SwimlaneSegment =
    | (RawSwimlaneCategorySegment & { color: Color })
    | SwimlaneMissingSegment

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
    labelPosition: { x: number; y: number }
    placedSegments: PlacedSwimlaneSegment[]
}

export type SwimlaneCategories =
    | { kind: "ordinal"; values: string[] }
    | { kind: "categorical"; values: string[] }
