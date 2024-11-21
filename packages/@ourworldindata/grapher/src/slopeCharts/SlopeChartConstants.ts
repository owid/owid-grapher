import { PartialBy, PointVector } from "@ourworldindata/utils"
import { ChartSeries } from "../chart/ChartInterface"

export interface SlopeChartSeries extends ChartSeries {
    startValue: number
    endValue: number
    annotation?: string
}

export type RawSlopeChartSeries = PartialBy<
    SlopeChartSeries,
    "startValue" | "endValue"
>

export interface PlacedSlopeChartSeries extends SlopeChartSeries {
    startPoint: PointVector
    endPoint: PointVector
}

export const DEFAULT_SLOPE_CHART_COLOR = "#ff7f0e"
