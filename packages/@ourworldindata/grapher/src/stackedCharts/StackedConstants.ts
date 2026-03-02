import { OwidVariableRow, SeriesName, Time } from "@ourworldindata/types"
import { ChartSeries } from "../chart/ChartInterface"
import {
    GRAPHER_AREA_OPACITY_DEFAULT,
    GRAPHER_AREA_OPACITY_HIGHLIGHTED,
    GRAPHER_AREA_OPACITY_MUTED,
} from "../core/GrapherConstants"
import { Point } from "@ourworldindata/utils"
import { InteractionState } from "../interaction/InteractionState.js"
import { Emphasis } from "../interaction/Emphasis"
import { LegendStyleConfig } from "../legend/LegendStyleConfig"

const opacityByEmphasis: Record<Emphasis, number> = {
    [Emphasis.Default]: GRAPHER_AREA_OPACITY_DEFAULT,
    [Emphasis.Highlighted]: GRAPHER_AREA_OPACITY_HIGHLIGHTED,
    [Emphasis.Muted]: GRAPHER_AREA_OPACITY_MUTED,
} as const

export interface StackedAreaStyleConfig {
    fillOpacity: number
    borderOpacity: number
    borderWidth: number
}

export interface StackedBarStyleConfig {
    opacity: number
}

export const STACKED_AREA_STYLE: Record<Emphasis, StackedAreaStyleConfig> = {
    [Emphasis.Default]: {
        fillOpacity: opacityByEmphasis.default,
        borderOpacity: 0.7,
        borderWidth: 0.5,
    },
    [Emphasis.Highlighted]: {
        fillOpacity: opacityByEmphasis.highlighted,
        borderOpacity: 1,
        borderWidth: 1.5,
    },
    [Emphasis.Muted]: {
        fillOpacity: opacityByEmphasis.muted,
        borderOpacity: 0.3,
        borderWidth: 0.5,
    },
}

export const STACKED_BAR_STYLE: Record<Emphasis, StackedBarStyleConfig> = {
    [Emphasis.Default]: { opacity: opacityByEmphasis.default },
    [Emphasis.Highlighted]: { opacity: opacityByEmphasis.highlighted },
    [Emphasis.Muted]: { opacity: opacityByEmphasis.muted },
}

export const LEGEND_STYLE_FOR_STACKED_CHARTS: LegendStyleConfig = {
    marker: {
        default: { opacity: opacityByEmphasis.default },
        highlighted: { opacity: opacityByEmphasis.highlighted },
        muted: { opacity: opacityByEmphasis.muted },
    },
    text: {
        muted: { opacity: opacityByEmphasis.muted },
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
    emphasis?: Emphasis
    hover?: InteractionState
    hoverTime?: Time
}

export interface RenderStackedAreaSeries<
    PositionType extends StackedPointPositionType,
> extends PlacedStackedAreaSeries<PositionType> {
    emphasis?: Emphasis
    hover?: InteractionState
}
