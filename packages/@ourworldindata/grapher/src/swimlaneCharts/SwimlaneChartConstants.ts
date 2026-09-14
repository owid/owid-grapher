import { ChartManager } from "../chart/ChartManager"
import { ChartSeries } from "../chart/ChartInterface"
import { Color, EntityName, Time } from "@ourworldindata/types"
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

export type ColoredSwimlaneSegment =
    | (SwimlaneCategorySegment & { color: Color })
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
    labelPosition: { x: number; y: number }
    placedSegments: PlacedSwimlaneSegment[]
}

export type SwimlaneCategories =
    | { kind: "ordinal"; values: string[] }
    | { kind: "categorical"; values: string[] }
