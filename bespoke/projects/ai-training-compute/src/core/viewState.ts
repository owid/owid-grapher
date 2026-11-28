import { useCallback, useState } from "react"

import {
    ColorScheme,
    FIRST_YEAR,
    LAST_YEAR,
    ModelFilter,
    YScaleType,
} from "./constants.js"

/** Everything about what the chart shows that a reader or a slide can change */
export interface ViewState {
    /** Models among the N largest at their release, or all notable ones */
    modelFilter: ModelFilter
    timeRange: [number, number]
    colorScheme: ColorScheme
    showComputers: boolean
    showThresholds: boolean
    /** The row of ECI leaders, most of them missing from the scatter */
    showFrontier: boolean
    showUncertainty: boolean
    /**
     * Logarithmic (the default, which the walkthroughs are written for) or
     * linear, which shows how far the latest runs dwarf everything before
     */
    yScaleType: YScaleType
}

export const DEFAULT_VIEW_STATE: ViewState = {
    // The top 5 at release: what Epoch AI calls frontier models
    modelFilter: 5,
    timeRange: [FIRST_YEAR, LAST_YEAR],
    colorScheme: "organization",
    showComputers: false,
    showThresholds: false,
    showFrontier: false,
    showUncertainty: false,
    yScaleType: "log",
}

export function clampYear(year: number): number {
    return Math.min(LAST_YEAR, Math.max(FIRST_YEAR, year))
}

/**
 * The reader's view, and whether its last change should animate: jumps the
 * reader asks for in one go (a link, a slide) do, dragging the slider
 * doesn't
 */
export function useViewState(initial: ViewState): {
    view: ViewState
    animate: boolean
    updateView: (
        change: Partial<ViewState>,
        options?: { animate?: boolean }
    ) => void
} {
    const [state, setState] = useState({ view: initial, animate: false })
    const updateView = useCallback(
        (change: Partial<ViewState>, options?: { animate?: boolean }) =>
            setState((current) => ({
                view: { ...current.view, ...change },
                animate: options?.animate ?? false,
            })),
        []
    )
    return { view: state.view, animate: state.animate, updateView }
}
