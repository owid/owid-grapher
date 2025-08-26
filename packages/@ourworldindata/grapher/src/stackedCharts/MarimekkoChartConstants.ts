import { ChartManager } from "../chart/ChartManager"

import {
    Color,
    SortConfig,
    Time,
    Bounds,
    EntityName,
    ColumnSlug,
} from "@ourworldindata/utils"
import { OwidTable } from "@ourworldindata/core-table"
import { StackedPoint } from "./StackedConstants"
import { DualAxis } from "../axis/Axis"
import { InteractionState } from "../interaction/InteractionState.js"

export interface MarimekkoChartManager extends ChartManager {
    endTime?: Time
    matchingEntitiesOnly?: boolean
    xOverrideTime?: number
    tableAfterAuthorTimelineAndActiveChartTransform?: OwidTable
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
    columnSlug?: ColumnSlug
}

export interface BarPlaceholder {
    kind: BarShape.BarPlaceholder
    seriesName: string
    height: number
}

export type BarOrPlaceholder = Bar | BarPlaceholder

export interface Item {
    entityName: string
    shortEntityName?: string
    entityColor: EntityColorData | undefined
    bars: Bar[] // contains the y values for every y variable
    xPoint: SimplePoint | undefined // contains the single x value
    focus: InteractionState
}

export interface PlacedItem extends Item {
    xPosition: number // x value (in pixel space) when placed in final sorted order and including shifts due to one pixel entity minimum
}

export interface EntityWithSize {
    entityName: string
    shortEntityName?: string
    xValue: number
    ySortValue: number | undefined
}
export interface LabelCandidate {
    item: EntityWithSize
    label: string
    bounds: Bounds
    isPicked: boolean
    isSelected: boolean
}

export interface LabelWithPlacement {
    label: React.ReactElement
    preferredPlacement: number
    correctedPlacement: number
    labelKey: string
}

export interface LabelCandidateWithElement {
    candidate: LabelCandidate
    labelElement: React.ReactElement
}

export interface MarimekkoBarProps {
    bar: BarOrPlaceholder
    barWidth: number
    isHovered: boolean
    isSelected: boolean
    isFaint: boolean
    focus: InteractionState
    entityColor: string | undefined
    y0: number
    dualAxis: DualAxis
}
