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
import { TextWrap } from "@ourworldindata/components"
import { InteractionState } from "../interaction/InteractionState.js"
import { LegendStyleConfig } from "../legend/LegendInteractionState"

export const AREA_OPACITY = {
    DEFAULT: GRAPHER_AREA_OPACITY_DEFAULT,
    FOCUS: GRAPHER_AREA_OPACITY_FOCUS,
    MUTE: GRAPHER_AREA_OPACITY_MUTE,
} as const

export const BAR_OPACITY = AREA_OPACITY

export const BORDER_OPACITY = {
    DEFAULT: 0.7,
    FOCUS: 1,
    MUTE: 0.3,
} as const

export const BORDER_WIDTH = {
    DEFAULT: 0.5,
    FOCUS: 1.5,
} as const

export const LEGEND_STYLE_FOR_STACKED_CHARTS: LegendStyleConfig = {
    marker: {
        default: { opacity: AREA_OPACITY.DEFAULT },
        focused: { opacity: AREA_OPACITY.FOCUS },
        muted: { opacity: AREA_OPACITY.MUTE },
    },
    text: {
        muted: { opacity: AREA_OPACITY.MUTE },
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
}

export interface Item {
    entityName: string
    shortEntityName?: string
    bars: Bar[]
    totalValue: number
    focus: InteractionState
}

export interface SizedItem extends Item {
    label: TextWrap
}

export interface PlacedItem extends SizedItem {
    yPosition: number
}
