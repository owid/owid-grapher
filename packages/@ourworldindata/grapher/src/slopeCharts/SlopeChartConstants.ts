import { PartialBy, PointVector } from "@ourworldindata/utils"
import { Color, EntityName, OwidVariableRow } from "@ourworldindata/types"
import { ChartSeries } from "../chart/ChartInterface"
import { CoreColumn } from "@ourworldindata/core-table"
import { ChartManager } from "../chart/ChartManager"
import { InteractionState } from "../interaction/InteractionState"
import { Emphasis } from "../interaction/Emphasis"
import {
    PointAnnotation,
    RangeAnnotation,
} from "../annotations/EntityAnnotations"

export interface SlopeChartManager extends ChartManager {
    canSelectMultipleEntities?: boolean // used to pick an appropriate series name
    hasTimeline?: boolean // used to filter the table for the entity selector
    hideNoDataSection?: boolean
}

export interface SlopeChartSeries extends ChartSeries {
    color: Color
    column: CoreColumn
    entityName: EntityName
    displayName: string
    start: OwidVariableRow<number>
    end: OwidVariableRow<number>
    annotation?: string
    focus: InteractionState
    pointAnnotations: PointAnnotation[]
    rangeAnnotations: RangeAnnotation[]
}

export type RawSlopeChartSeries = PartialBy<SlopeChartSeries, "start" | "end">

export interface PlacedSlopeChartSeries extends SlopeChartSeries {
    startPoint: PointVector
    endPoint: PointVector
}

export interface RenderSlopeChartSeries extends PlacedSlopeChartSeries {
    hover: InteractionState
    emphasis: Emphasis
}
