import { Color } from "@ourworldindata/types"

/**
 * Represents the visual state of a legend item
 */
export enum LegendInteractionState {
    /** No interaction, default state */
    Default = "default",
    /** Item is de-emphasized (e.g., when another item is hovered) */
    Muted = "muted",
    /** Item is highlighted */
    Focused = "focused",
}

/**
 * Visual styling for legend label text in a particular state.
 */
export interface LegendTextStyle {
    opacity?: number
    fontWeight?: number
    color?: Color
}

/**
 * Visual styling for legend marker/rect in a particular state.
 */
export interface LegendMarkerStyle {
    opacity?: number
    fill?: Color
    strokeWidth?: number
    stroke?: Color
}

/**
 * Complete style configuration for all possible legend item states.
 */
export interface LegendStyleConfig {
    text?: Partial<Record<LegendInteractionState, LegendTextStyle>>
    marker?: Partial<Record<LegendInteractionState, LegendMarkerStyle>>
}
