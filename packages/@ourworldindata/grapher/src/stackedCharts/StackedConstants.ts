import {
    Color,
    EntityName,
    OwidVariableRow,
    SeriesName,
} from "@ourworldindata/types"
import { ChartSeries } from "../chart/ChartInterface"
import {
    GRAPHER_AREA_OPACITY_DEFAULT,
    GRAPHER_AREA_OPACITY_FOCUS,
    GRAPHER_AREA_OPACITY_MUTE,
} from "../core/GrapherConstants"
import { InteractionState } from "../interaction/InteractionState.js"
import { HighlightState } from "../interaction/HighlightState.js"
import { SeriesLabelState } from "../seriesLabel/SeriesLabelState.js"
import { LegendStyleConfig } from "../legend/LegendInteractionState"

export const areaOpacityByState: Record<HighlightState, number> = {
    default: GRAPHER_AREA_OPACITY_DEFAULT,
    focus: GRAPHER_AREA_OPACITY_FOCUS,
    muted: GRAPHER_AREA_OPACITY_MUTE,
} as const

export const barOpacityByState = areaOpacityByState

export const borderOpacityByState: Record<HighlightState, number> = {
    default: 0.7,
    focus: 1,
    muted: 0.3,
} as const

export const borderWidthByState: Record<HighlightState, number> = {
    default: 0.5,
    focus: 1.5,
    muted: 0.5,
} as const

export const LEGEND_STYLE_FOR_STACKED_CHARTS: LegendStyleConfig = {
    marker: {
        default: { opacity: areaOpacityByState.default },
        focused: { opacity: areaOpacityByState.focus },
        muted: { opacity: areaOpacityByState.muted },
    },
    text: {
        muted: { opacity: areaOpacityByState.muted },
    },
}

export type StackedPointPositionType = string | number

export type StackedPlacedPoint = [number, number]

// PositionType can be categorical (e.g. country names), or ordinal (e.g. years).
export interface StackedPoint<PositionType extends StackedPointPositionType> {
    position: PositionType
    value: number
    valueOffset: number
    time: number
    interpolated?: boolean
    fake?: boolean
    color?: string
}

export interface StackedSeries<PositionType extends StackedPointPositionType>
    extends ChartSeries {
    points: StackedPoint<PositionType>[]
    columnSlug?: string
    isProjection?: boolean
    isAllZeros?: boolean
    shortEntityName?: string
    focus?: InteractionState
}

export interface StackedPlacedSeries<
    PositionType extends StackedPointPositionType,
> extends StackedSeries<PositionType> {
    placedPoints: Array<StackedPlacedPoint>
}

export interface StackedRawSeries<
    PositionType extends StackedPointPositionType,
> {
    seriesName: SeriesName
    isProjection?: boolean
    rows: OwidVariableRow<PositionType>[]
    focus: InteractionState
    shortEntityName?: string
}

export interface Bar {
    color: Color
    seriesName: string
    columnSlug: string
    point: StackedPoint<EntityName>
    focus: InteractionState
}

export interface Item {
    entityName: string
    shortEntityName?: string
    bars: Bar[]
    totalValue: number
    focus: InteractionState
}

export interface SizedItem extends Item {
    label: SeriesLabelState
}

export interface PlacedItem extends SizedItem {
    yPosition: number
}
