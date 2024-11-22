import { PartialBy, PointVector } from "@ourworldindata/utils"
import { EntityName, OwidVariableRow } from "@ourworldindata/types"
import { ChartSeries } from "../chart/ChartInterface"

export interface SlopeChartSeries extends ChartSeries {
    entityName: EntityName
    start: Pick<OwidVariableRow<number>, "value" | "originalTime">
    end: Pick<OwidVariableRow<number>, "value" | "originalTime">
    annotation?: string
}

export type RawSlopeChartSeries = PartialBy<SlopeChartSeries, "start" | "end">

export interface PlacedSlopeChartSeries extends SlopeChartSeries {
    startPoint: PointVector
    endPoint: PointVector
}

export const DEFAULT_SLOPE_CHART_COLOR = "#ff7f0e"
