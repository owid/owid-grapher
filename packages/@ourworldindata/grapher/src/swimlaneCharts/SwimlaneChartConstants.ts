import { ChartManager } from "../chart/ChartManager"
import { ChartSeries } from "../chart/ChartInterface"
import { Color, EntityName } from "@ourworldindata/types"
import { SeriesLabelState } from "../seriesLabel/SeriesLabelState"
import {
    SwimlaneCategorySegment,
    SwimlaneMissingSegment,
} from "./swimlaneSegments"

export type SwimlaneChartManager = ChartManager

export type SwimlaneSeriesSegment =
    | (SwimlaneCategorySegment & { color: Color })
    | SwimlaneMissingSegment

export interface SwimlaneSeries extends ChartSeries {
    seriesName: EntityName
    entityName: EntityName
    shortEntityName?: string
    segments: SwimlaneSeriesSegment[]
}

export interface SizedSwimlaneSeries extends SwimlaneSeries {
    label: SeriesLabelState
}

export type PlacedSwimlaneSegment = SwimlaneSeriesSegment & {
    x: number
    width: number
    y: number
    height: number
}

export interface PlacedSwimlaneSeries extends SizedSwimlaneSeries {
    y: number
    labelPosition: { x: number; y: number }
    placedSegments: PlacedSwimlaneSegment[]
}

export const LANE_SPACING_FACTOR = 0.35

export const ENTITY_LABEL_CHART_GAP = 8

export const TICK_LABEL_OVERFLOW_PADDING = 2

/** The categories a swimlane draws, in draw order */
export type SwimlaneCategories =
    | { kind: "ordinal"; values: string[] }
    | { kind: "categorical"; values: string[] }
