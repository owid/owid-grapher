import {
    Color,
    EntityName,
    InteractionState,
    OwidVariableRow,
    SeriesName,
} from "@ourworldindata/types"
import { ChartSeries } from "../chart/ChartInterface"
import {
    GRAPHER_AREA_OPACITY_DEFAULT,
    GRAPHER_AREA_OPACITY_FOCUS,
    GRAPHER_AREA_OPACITY_MUTE,
} from "../core/GrapherConstants"
import { TextWrap } from "@ourworldindata/components"

export const BAR_OPACITY = {
    DEFAULT: GRAPHER_AREA_OPACITY_DEFAULT,
    FOCUS: GRAPHER_AREA_OPACITY_FOCUS,
    MUTE: GRAPHER_AREA_OPACITY_MUTE,
}

export const AREA_OPACITY = {
    default: GRAPHER_AREA_OPACITY_DEFAULT,
    focus: GRAPHER_AREA_OPACITY_FOCUS,
    mute: GRAPHER_AREA_OPACITY_MUTE,
} as const

export const BORDER_OPACITY = {
    default: 0.7,
    focus: 1,
    mute: 0.3,
} as const

export const BORDER_WIDTH = {
    default: 0.5,
    focus: 1.5,
} as const

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
}

export interface Bar {
    color: Color
    seriesName: string
    columnSlug: string
    point: StackedPoint<EntityName>
}

export interface Item {
    entityName: string
    shortEntityName?: string
    bars: Bar[]
    totalValue: number
}

export interface SizedItem extends Item {
    label: TextWrap
}

export interface PlacedItem extends SizedItem {
    yPosition: number
}
