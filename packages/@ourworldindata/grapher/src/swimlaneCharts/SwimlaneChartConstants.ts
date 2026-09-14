import { ChartManager } from "../chart/ChartManager"
import { ChartSeries } from "../chart/ChartInterface"
import { Color, EntityName } from "@ourworldindata/types"
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
    segments: SwimlaneSeriesSegment[]
}

/** The categories a swimlane draws, in draw order */
export type SwimlaneCategories =
    | { kind: "ordinal"; values: string[] }
    | { kind: "categorical"; values: string[] }
