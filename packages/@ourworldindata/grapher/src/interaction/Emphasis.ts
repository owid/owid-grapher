import { InteractionState } from "./InteractionState.js"

export enum Emphasis {
    Default = "default",
    Highlighted = "highlighted",
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
