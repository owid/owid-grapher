import { ChartManager } from "../chart/ChartManager"

import { Color, SortBy, Time, Bounds, EntityName } from "@ourworldindata/utils"
import { OwidTable } from "@ourworldindata/core-table"
import { ChartSeries } from "../chart/ChartInterface"
import { InteractionState } from "../interaction/InteractionState.js"
import { Emphasis } from "../interaction/Emphasis.js"

export interface MarimekkoChartManager extends ChartManager {
    xOverrideTime?: number
    tableAfterAuthorTimelineAndActiveChartTransform?: OwidTable
}

export interface EntityColorData {
    color: Color
    colorDomainValue: string
}

/** One indicator's value for one entity, at the time it was observed */
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
    xPoint: MarimekkoPoint | undefined
    entityColor: EntityColorData | undefined
    focus: InteractionState
}

export interface PlacedMarimekkoSeries extends MarimekkoSeries {
    barX: number
    barY: number // the baseline; the bar is drawn upwards from here
    barWidth: number
    barHeight: number
}

export interface RenderMarimekkoSeries extends PlacedMarimekkoSeries {
    /**
     * Drives the fill. A hovered bar reads as highlighted even while the rest of it
     * is faded, so this can be `Highlighted` while `isMuted` is true.
     */
    emphasis: Emphasis
    /** Faded because another bar is hovered, focused, or selected */
    isMuted: boolean
    /** Hovered or selected: thicker stroke, and drawn last so it overlaps its neighbours */
    isOutlined: boolean
}

/** The hatched band covering the entities that have no y value */
export interface MarimekkoNoDataArea {
    x: number
    y: number
    width: number
    height: number
    labelX: number
    labelY: number
}

/** 0 is horizontal, -90 is vertical from bottom to top, ... */
export const LABEL_ANGLE_IN_DEGREES = -45

/** An entity that could be labelled under the x axis */
export interface MarimekkoLabelCandidate {
    entityName: EntityName
    text: string
    bounds: Bounds
    /** The entity's x indicator value, i.e. its bar width in domain units */
    xValue: number
    /** The y value at the latest time point, not at the selected one */
    ySortValue: number | undefined
    isSelected: boolean
}

/** A picked label, positioned along the x axis */
export interface PlacedMarimekkoLabel {
    entityName: EntityName
    text: string
    color: Color
    isSelected: boolean
    /** The centre of the entity's bar */
    preferredX: number
    /** Shifted away from `preferredX` to clear neighbouring labels */
    correctedX: number
}

/**
 * The label run's extent, before and after rotation by `LABEL_ANGLE_IN_DEGREES`
 */
export interface MarimekkoLabelMeasurements {
    unrotatedMaxWidth: number
    unrotatedMaxHeight: number
    rotatedMaxWidth: number
    rotatedMaxHeight: number
}

export const MARIMEKKO_SORT_KEYS = [
    SortBy.custom,
    SortBy.entityName,
    SortBy.total,
] as const
export type MarimekkoSortKey = (typeof MARIMEKKO_SORT_KEYS)[number]
