import { OwidVariableRow, SeriesName, Time } from "@ourworldindata/types"
import { ChartSeries } from "../chart/ChartInterface"
import { Point } from "@ourworldindata/utils"
import { InteractionState } from "../interaction/InteractionState.js"
import { Emphasis, OPACITY_BY_EMPHASIS } from "../interaction/Emphasis"
import { LegendStyleConfig } from "../legend/LegendStyleConfig"

export interface StackedAreaStyleConfig {
    fillOpacity: number
    borderOpacity: number
    borderWidth: number
}

export interface StackedBarStyleConfig {
    opacity: number
}

const DEFAULT_STACKED_AREA_STYLE: StackedAreaStyleConfig = {
    fillOpacity: OPACITY_BY_EMPHASIS[Emphasis.Default],
    borderOpacity: 0.7,
    borderWidth: 0.5,
}

export const STACKED_AREA_STYLE: Record<Emphasis, StackedAreaStyleConfig> = {
    [Emphasis.Default]: DEFAULT_STACKED_AREA_STYLE,
    [Emphasis.Elevated]: DEFAULT_STACKED_AREA_STYLE,
    [Emphasis.Highlighted]: {
        fillOpacity: OPACITY_BY_EMPHASIS[Emphasis.Highlighted],
        borderOpacity: 1,
        borderWidth: 1.5,
    },
    [Emphasis.Muted]: {
        fillOpacity: OPACITY_BY_EMPHASIS[Emphasis.Muted],
        borderOpacity: 0.3,
        borderWidth: 0.5,
    },
}

export const STACKED_BAR_STYLE: Record<Emphasis, StackedBarStyleConfig> = {
    [Emphasis.Default]: { opacity: OPACITY_BY_EMPHASIS[Emphasis.Default] },
    [Emphasis.Elevated]: { opacity: OPACITY_BY_EMPHASIS[Emphasis.Default] },
    [Emphasis.Highlighted]: {
        opacity: OPACITY_BY_EMPHASIS[Emphasis.Highlighted],
    },
    [Emphasis.Muted]: { opacity: OPACITY_BY_EMPHASIS[Emphasis.Muted] },
}

export const LEGEND_STYLE_FOR_STACKED_CHARTS: LegendStyleConfig = {
    marker: {
        default: { opacity: OPACITY_BY_EMPHASIS[Emphasis.Default] },
        highlighted: { opacity: OPACITY_BY_EMPHASIS[Emphasis.Highlighted] },
        muted: { opacity: OPACITY_BY_EMPHASIS[Emphasis.Muted] },
    },
    text: {
        muted: { opacity: OPACITY_BY_EMPHASIS[Emphasis.Muted] },
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
