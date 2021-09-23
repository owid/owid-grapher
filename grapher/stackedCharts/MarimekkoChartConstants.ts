import { ChartManager } from "../chart/ChartManager"

import { Color, SortConfig, Time } from "../../clientUtils/owidTypes"
import { EntityId, EntityName } from "../../coreTable/OwidTableConstants"
import { OwidTable } from "../../coreTable/OwidTable"
import { StackedPoint } from "./StackedConstants"
import { CoreColumn } from "../../coreTable/CoreTableColumns"
import { Bounds } from "../../clientUtils/Bounds"
import { DualAxis } from "../axis/Axis"
export interface MarimekkoChartManager extends ChartManager {
    endTime?: Time
    excludedEntities?: EntityId[]
    matchingEntitiesOnly?: boolean
    xOverrideTime?: number
    tableAfterAuthorTimelineAndActiveChartTransformAndPopulationFilter?: OwidTable
    sortConfig?: SortConfig
    hideNoDataArea?: boolean
}

export interface EntityColorData {
    color: Color
    colorDomainValue: string
}
// Points used on the X axis
export interface SimplePoint {
    value: number
    entity: string
    time: number
}

export interface SimpleChartSeries {
    seriesName: string
    points: SimplePoint[]
}

export enum BarShape {
    Bar,
    BarPlaceholder,
}

export interface Bar {
    kind: BarShape.Bar
    color: Color // color from the variable
    seriesName: string
    yPoint: StackedPoint<EntityName>
}

export interface BarPlaceholder {
    kind: BarShape.BarPlaceholder
    seriesName: string
    height: number
}

export type BarOrPlaceholder = Bar | BarPlaceholder

export interface Item {
    entityName: string
    entityColor: EntityColorData | undefined
    bars: Bar[] // contains the y values for every y variable
    xPoint: SimplePoint // contains the single x value
}

export interface PlacedItem extends Item {
    xPosition: number // x value (in pixel space) when placed in final sorted order and including shifts due to one pixel entity minimum
}

export interface TooltipProps {
    item: Item
    highlightedSeriesName?: string
    targetTime?: Time
    timeColumn: CoreColumn
    yAxisColumn: CoreColumn
    xAxisColumn: CoreColumn
}

export interface EntityWithSize {
    entityName: string
    xValue: number
    ySortValue: number | undefined
}
export interface LabelCandidate {
    item: EntityWithSize
    bounds: Bounds
    isPicked: boolean
    isSelected: boolean
}

export interface LabelWithPlacement {
    label: JSX.Element
    preferredPlacement: number
    correctedPlacement: number
    labelKey: string
}

export interface LabelCandidateWithElement {
    candidate: LabelCandidate
    labelElement: JSX.Element
}
export interface MarimekkoBarProps {
    bar: BarOrPlaceholder
    tooltipProps: TooltipProps | undefined
    barWidth: number
    isHovered: boolean
    isSelected: boolean
    isFaint: boolean
    entityColor: string | undefined
    y0: number
    isInteractive: boolean
    dualAxis: DualAxis
}
