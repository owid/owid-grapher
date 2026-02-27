import {
    Color,
    EntityName,
    OwidVariableRow,
    SeriesName,
    Time,
} from "@ourworldindata/types"
import { ChartSeries } from "../chart/ChartInterface"
import {
    GRAPHER_AREA_OPACITY_DEFAULT,
    GRAPHER_AREA_OPACITY_FOCUS,
    GRAPHER_AREA_OPACITY_MUTE,
} from "../core/GrapherConstants"
import { Point } from "@ourworldindata/utils"
import { InteractionState } from "../interaction/InteractionState.js"
import { SeriesLabelState } from "../seriesLabel/SeriesLabelState.js"
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

/** Either categorical (e.g. country names), or ordinal (e.g. years)  */
export type StackedPointPositionType = string | number

export interface StackedPoint<PositionType extends StackedPointPositionType> {
    position: PositionType
    value: number
    valueOffset: number
    time: number
    formattedTime?: string
    color?: string
    missing?: boolean
    interpolated?: boolean
}

export interface PlacedStackedPoint<
    PositionType extends StackedPointPositionType,
> extends StackedPoint<PositionType> {
    x: number
    y: number
    barWidth: number
    barHeight: number
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

export interface StackedSeries<
    PositionType extends StackedPointPositionType,
> extends ChartSeries {
    points: StackedPoint<PositionType>[]
    columnSlug?: string
    isProjection?: boolean
    isAllZeros?: boolean
    shortEntityName?: string
    focus?: InteractionState
}

export interface PlacedStackedBarSeries<
    PositionType extends StackedPointPositionType,
> extends StackedSeries<PositionType> {
    placedPoints: PlacedStackedPoint<PositionType>[]
}

export interface PlacedStackedAreaSeries<
    PositionType extends StackedPointPositionType,
> extends StackedSeries<PositionType> {
    /** Top edge border of the area */
    placedPoints: Point[]
    /** Points defining the filled area polygon */
    areaPoints: Point[]
}

export interface RenderStackedBarSeries<
    PositionType extends StackedPointPositionType,
> extends PlacedStackedBarSeries<PositionType> {
    hover?: InteractionState
    hoverTime?: Time
}

export interface RenderStackedAreaSeries<
    PositionType extends StackedPointPositionType,
> extends PlacedStackedAreaSeries<PositionType> {
    hover?: InteractionState
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
    label: SeriesLabelState
}

export interface PlacedItem extends SizedItem {
    yPosition: number
}
