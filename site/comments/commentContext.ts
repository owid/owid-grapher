import {
    CommentTarget,
    CommentTargetType,
    CommentViewState,
} from "@ourworldindata/types"

/**
 * What a page lets staff comment on. Serialized by the page renderers (only
 * when previewing) so the overlay never has to infer targets from the grapher
 * config, and so a page can expose several targets at once: a chart page also
 * carries the indicators it draws on, so indicator-level feedback left
 * elsewhere still surfaces here.
 */
export interface CommentPageTarget extends CommentTarget {
    /** Shown in the panel to say which thing a thread hangs off */
    label: string
}

export interface CommentPageContext {
    /**
     * Everything the page can show comments for. The first entry is the page's
     * subject and receives newly created comments.
     */
    targets: CommentPageTarget[]
    /**
     * Dimension slugs of a multi-dim, used to read the current view out of the
     * URL. Absent on charts and data pages.
     */
    multiDimDimensionSlugs?: string[]
}

declare global {
    interface Window {
        _OWID_COMMENT_CONTEXT?: CommentPageContext
    }
}

/**
 * Builds the context a preview page serializes. Called during server rendering,
 * so it must not touch the DOM.
 */
export function buildCommentPageContext({
    chartId,
    chartLabel,
    multiDim,
    variables,
}: {
    chartId?: number
    chartLabel?: string
    multiDim?: { id: number; label: string; dimensionSlugs: string[] }
    variables?: { variableId: number; label: string }[]
}): CommentPageContext | undefined {
    const targets: CommentPageTarget[] = []
    // The page's subject goes first and receives new comments
    if (multiDim)
        targets.push({
            targetType: CommentTargetType.MultiDim,
            targetId: multiDim.id,
            label: multiDim.label,
        })
    else if (chartId !== undefined)
        targets.push({
            targetType: CommentTargetType.Chart,
            targetId: chartId,
            label: chartLabel ?? "This chart",
        })
    for (const variable of variables ?? []) {
        targets.push({
            targetType: CommentTargetType.Variable,
            targetId: variable.variableId,
            label: variable.label,
        })
    }
    if (!targets.length) return undefined
    return {
        targets,
        multiDimDimensionSlugs: multiDim?.dimensionSlugs,
    }
}

export function getCommentPageContext(): CommentPageContext | undefined {
    const context = window._OWID_COMMENT_CONTEXT
    return context?.targets.length ? context : undefined
}

export function isSameTarget(a: CommentTarget, b: CommentTarget): boolean {
    return a.targetType === b.targetType && a.targetId === b.targetId
}

/**
 * The multi-dim view currently on screen, read from the URL because that is
 * where MultiDimDataPageContent keeps the dimension choices in sync. Returns
 * null on pages that aren't multi-dims, so comments there are view-independent.
 */
export function readViewStateFromUrl(
    dimensionSlugs: string[] | undefined
): CommentViewState | null {
    if (!dimensionSlugs?.length) return null
    const params = new URLSearchParams(window.location.search)
    const viewState: CommentViewState = {}
    for (const slug of dimensionSlugs) {
        const value = params.get(slug)
        if (value !== null) viewState[slug] = value
    }
    return Object.keys(viewState).length ? viewState : null
}

/** Two views are the same when they pick the same choice for every dimension */
export function isSameViewState(
    a: CommentViewState | null,
    b: CommentViewState | null
): boolean {
    if (!a || !b) return !a && !b
    const keys = new Set([...Object.keys(a), ...Object.keys(b)])
    for (const key of keys) if (a[key] !== b[key]) return false
    return true
}

/**
 * Fires whenever the multi-dim view changes. The mdim page pushes its settings
 * into the URL, and there is no DOM event for a pushState, so we poll the
 * search string; it is a string compare a few times a second, and it keeps the
 * overlay from having to reach into the mdim's React state.
 */
export function subscribeToUrlChanges(onChange: () => void): () => void {
    let lastSearch = window.location.search
    const check = (): void => {
        if (window.location.search === lastSearch) return
        lastSearch = window.location.search
        onChange()
    }
    const interval = window.setInterval(check, 400)
    window.addEventListener("popstate", check)
    return () => {
        window.clearInterval(interval)
        window.removeEventListener("popstate", check)
    }
}
