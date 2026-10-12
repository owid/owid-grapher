import { Color } from "@ourworldindata/types"
import { ColorScaleBin } from "../color/ColorScaleBin"
import { GRAPHER_DARK_TEXT } from "../color/ColorConstants"
import { Emphasis } from "../interaction/Emphasis"

/**
 * How each bin a legend shows should be emphasised. Resolved by the chart and
 * handed to the legend as a render prop, so the legend itself stays a pure
 * function of its props. Bins missing from the map render at `Emphasis.Default`.
 */
export type BinEmphasis = Map<ColorScaleBin, Emphasis>

/** Resolves every bin's emphasis into a map */
export function toBinEmphasis(
    bins: readonly ColorScaleBin[],
    resolve: (bin: ColorScaleBin) => Emphasis
): BinEmphasis {
    return new Map(bins.map((bin) => [bin, resolve(bin)]))
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
    text?: Partial<Record<Emphasis, LegendTextStyle>>
    marker?: Partial<Record<Emphasis, LegendMarkerStyle>>
}

/**
 * Merges the style config's default styling with its override for `emphasis`.
 * The legend's own defaults come first, so a config can override any of them.
 */
export function resolveLegendTextStyle(
    styleConfig: LegendStyleConfig | undefined,
    emphasis: Emphasis | undefined
): LegendTextStyle {
    const text = styleConfig?.text
    return {
        color: GRAPHER_DARK_TEXT,
        ...text?.default,
        ...text?.[emphasis ?? Emphasis.Default],
    }
}

/** The marker equivalent of `resolveLegendTextStyle`. */
export function resolveLegendMarkerStyle(
    styleConfig: LegendStyleConfig | undefined,
    emphasis: Emphasis | undefined,
    defaults: LegendMarkerStyle
): LegendMarkerStyle {
    const marker = styleConfig?.marker
    return {
        ...defaults,
        ...marker?.default,
        ...marker?.[emphasis ?? Emphasis.Default],
    }
}
