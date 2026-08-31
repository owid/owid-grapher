import {
    GRAPHER_AREA_OPACITY_DEFAULT,
    GRAPHER_AREA_OPACITY_HIGHLIGHTED,
    GRAPHER_AREA_OPACITY_MUTED,
} from "../core/GrapherConstants.js"
import { InteractionState } from "./InteractionState.js"

export enum Emphasis {
    /** Default emphasis */
    Default = "default",
    /** Slightly elevated emphasis */
    Elevated = "elevated",
    /** Strongly highlighted emphasis */
    Highlighted = "highlighted",
    /** Muted emphasis */
    Muted = "muted",
}

export const OPACITY_BY_EMPHASIS: Record<Emphasis, number> = {
    [Emphasis.Default]: GRAPHER_AREA_OPACITY_DEFAULT,
    [Emphasis.Elevated]: GRAPHER_AREA_OPACITY_DEFAULT,
    [Emphasis.Highlighted]: GRAPHER_AREA_OPACITY_HIGHLIGHTED,
    [Emphasis.Muted]: GRAPHER_AREA_OPACITY_MUTED,
}

export function resolveEmphasis({
    hover,
    focus,
}: {
    hover?: InteractionState
    focus?: InteractionState
}): Emphasis {
    if (hover?.active || focus?.active) return Emphasis.Highlighted
    if (hover?.background || focus?.background) return Emphasis.Muted
    return Emphasis.Default
}
