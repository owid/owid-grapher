import { Color, EntityName } from "@ourworldindata/types"
import { StackedPoint } from "./StackedConstants.js"
import { Emphasis } from "../interaction/Emphasis.js"
import { InteractionState } from "../interaction/InteractionState.js"
import { SeriesLabelState } from "../seriesLabel/SeriesLabelState.js"
import { GRAPHER_AREA_OPACITY_MUTED } from "../core/GrapherConstants.js"

interface LabelStyleConfig {
    opacity: number
}

export const LABEL_STYLE: Record<Emphasis, LabelStyleConfig> = {
    [Emphasis.Default]: { opacity: 1 },
    [Emphasis.Highlighted]: { opacity: 1 },
    [Emphasis.Muted]: { opacity: GRAPHER_AREA_OPACITY_MUTED },
}

/** One row in the stacked discrete bar chart, grouping all bar segments for a single entity */
export interface DiscreteBarRow {
    entityName: string
    shortEntityName?: string
    bars: BarSegment[]
    totalValue: number
    focus: InteractionState
}

export interface SizedDiscreteBarRow extends DiscreteBarRow {
    label: SeriesLabelState
}

export interface PlacedDiscreteBarRow extends SizedDiscreteBarRow {
    yPosition: number
    placedBars: PlacedBarSegment[]
}

export interface RenderDiscreteBarRow extends PlacedDiscreteBarRow {
    emphasis: Emphasis
    segments: RenderBarSegment[]
}

/** A single colored slice within a stacked bar, representing one indicator for one entity */
export interface BarSegment {
    seriesName: string
    color: Color
    columnSlug: string
    point: StackedPoint<EntityName>
}

export interface PlacedBarSegment extends BarSegment {
    x: number
    barWidth: number
}

export interface RenderBarSegment extends PlacedBarSegment {
    focus: InteractionState
    hover: InteractionState
    emphasis: Emphasis
}
