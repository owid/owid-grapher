import { PartialBy, PointVector } from "@ourworldindata/utils"
import {
    EntityName,
    InteractionState,
    OwidVariableRow,
} from "@ourworldindata/types"
import { ChartSeries } from "../chart/ChartInterface"
import { CoreColumn } from "@ourworldindata/core-table"

export interface SlopeChartSeries extends ChartSeries {
    column: CoreColumn
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

export interface RenderSlopeChartSeries extends PlacedSlopeChartSeries {
    hover: InteractionState
    focus: InteractionState
}
