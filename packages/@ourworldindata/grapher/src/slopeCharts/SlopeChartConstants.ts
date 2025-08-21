import { PartialBy, PointVector } from "@ourworldindata/utils"
import { EntityName, OwidVariableRow } from "@ourworldindata/types"
import { ChartSeries } from "../chart/ChartInterface"
import { CoreColumn } from "@ourworldindata/core-table"
import { ChartManager } from "../chart/ChartManager"
import { InteractionState } from "../interaction/InteractionState"

export interface SlopeChartManager extends ChartManager {
    canSelectMultipleEntities?: boolean // used to pick an appropriate series name
    hasTimeline?: boolean // used to filter the table for the entity selector
    hideNoDataSection?: boolean
}

export interface SlopeChartSeries extends ChartSeries {
    column: CoreColumn
    entityName: EntityName
    displayName: string
    start: Pick<OwidVariableRow<number>, "value" | "originalTime">
    end: Pick<OwidVariableRow<number>, "value" | "originalTime">
    annotation?: string
    focus: InteractionState
}

export type RawSlopeChartSeries = PartialBy<SlopeChartSeries, "start" | "end">

export interface PlacedSlopeChartSeries extends SlopeChartSeries {
    startPoint: PointVector
    endPoint: PointVector
}

export interface RenderSlopeChartSeries extends PlacedSlopeChartSeries {
    hover: InteractionState
}
