import { Color } from "@ourworldindata/types"
import { Emphasis } from "../interaction/Emphasis"

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
    text?: Partial<Record<Emphasis, LegendTextStyle>>
    marker?: Partial<Record<Emphasis, LegendMarkerStyle>>
}
