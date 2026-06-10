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
