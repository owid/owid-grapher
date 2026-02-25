import { InteractionState } from "./InteractionState"

/** The visual state of a chart element */
export enum HighlightState {
    /** Actively highlighted */
    Focus = "focus",
    /** No interaction is active; normal appearance */
    Default = "default",
    /** Pushed to background */
    Muted = "muted",
}

/**
 * Combines two interaction dimensions into a single visual state.
 *
 * The override state takes precedence when active (e.g. hover overrides focus).
 * When the override state is idle, the primary state determines the result.
 */
export function resolveHighlightState(
    primaryState: InteractionState,
    overrideState?: InteractionState
): HighlightState {
    const state =
        !overrideState || overrideState.idle ? primaryState : overrideState

    if (state.active) return HighlightState.Focus
    if (state.background) return HighlightState.Muted
    return HighlightState.Default
}
