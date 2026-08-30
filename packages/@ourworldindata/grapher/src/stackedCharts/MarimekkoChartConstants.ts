import { ChartManager } from "../chart/ChartManager"

import {
    Color,
    SortBy,
    SortConfig,
    Time,
    Bounds,
    EntityName,
} from "@ourworldindata/utils"
import { OwidTable } from "@ourworldindata/core-table"
import { ChartSeries } from "../chart/ChartInterface"
import { InteractionState } from "../interaction/InteractionState.js"

export interface MarimekkoChartManager extends ChartManager {
    endTime?: Time
    matchingEntitiesOnly?: boolean
    xOverrideTime?: number
    tableAfterAuthorTimelineAndActiveChartTransform?: OwidTable
    sortConfig?: SortConfig
    hideNoDataArea?: boolean
    hasScatter?: boolean // x-axis is ignored if a secondary scatter plot is present
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

/** The y value of one entity */
export interface MarimekkoPoint {
    value: number
    time: Time
}

/**
 * One entity's rectangle: width from the x indicator, height from the y indicator.
 * Marimekko plots one series per entity, so `seriesName` and `entityName` always agree.
 */
export interface MarimekkoSeries extends ChartSeries {
    entityName: EntityName
    shortEntityName?: string
    /** Undefined when the entity has no y value, which draws the no-data placeholder */
    yPoint: MarimekkoPoint | undefined
    xPoint: SimplePoint | undefined
    entityColor: EntityColorData | undefined
    focus: InteractionState
}

export interface PlacedMarimekkoSeries extends MarimekkoSeries {
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

export const MARIMEKKO_SORT_KEYS = [
    SortBy.custom,
    SortBy.entityName,
    SortBy.total,
] as const
export type MarimekkoSortKey = (typeof MARIMEKKO_SORT_KEYS)[number]
