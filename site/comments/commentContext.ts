import {
    CommentTarget,
    CommentTargetType,
    CommentViewState,
    DataPageDataV2,
    GrapherInterface,
} from "@ourworldindata/types"
import {
    CommentField,
    chartCommentFields,
    chartFieldsFromConfig,
    indicatorCommentFields,
} from "./commentFields.js"

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

/**
 * A multi-dim dimension, reduced to what the overlay needs: the slug to read the
 * view out of the URL, and names to say in words which view a comment sits on.
 */
export interface CommentMultiDimDimension {
    slug: string
    name: string
    choices: { slug: string; name: string }[]
}

export interface CommentPageContext {
    /**
     * Everything the page can show comments for. The first entry is the page's
     * subject and receives newly created comments.
     */
    targets: CommentPageTarget[]
    /** The metadata fields on this page that can be commented on */
    fields: CommentField[]
    /**
     * The dimensions of a multi-dim, used to read the current view out of the
     * URL and to label the other views that hold comments. Absent on charts and
     * data pages.
     */
    multiDimDimensions?: CommentMultiDimDimension[]
    /**
     * The view a multi-dim opens on. The page only writes dimensions into the
     * URL once the reader changes one, so without this a comment left on the
     * landing view would record no view at all and then show up on every view.
     */
    multiDimDefaultView?: CommentViewState
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
    grapher,
    multiDim,
    variables,
    datapageData,
}: {
    chartId?: number
    chartLabel?: string
    /** Used only to tell which chart-level fields the page actually shows */
    grapher?: GrapherInterface
    multiDim?: {
        id: number
        label: string
        dimensions: CommentMultiDimDimension[]
        defaultView?: CommentViewState
    }
    variables?: { variableId: number; label: string }[]
    datapageData?: DataPageDataV2
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
    const firstVariableIndex = targets.length
    for (const variable of variables ?? []) {
        targets.push({
            targetType: CommentTargetType.Variable,
            targetId: variable.variableId,
            label: variable.label,
        })
    }
    if (!targets.length) return undefined

    // Chart-level fields belong to the chart or multi-dim when the page has
    // one. An indicator preview has neither, so they fall to the indicator,
    // whose own default config is what's being rendered anyway.
    const chartLevel = multiDim
        ? chartCommentFields(0)
        : chartId !== undefined
          ? chartFieldsFromConfig(grapher, 0)
          : chartFieldsFromConfig(grapher, firstVariableIndex)
    const indicatorLevel = datapageData
        ? indicatorCommentFields(datapageData, firstVariableIndex)
        : []

    return {
        targets,
        fields: [...chartLevel, ...indicatorLevel],
        multiDimDimensions: multiDim?.dimensions,
        multiDimDefaultView: multiDim?.defaultView,
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
 * The multi-dim view currently on screen: the page's default choices, with
 * whatever the reader has since picked layered on top from the URL, which is
 * where MultiDimDataPageContent keeps them in sync. Returns null on pages that
 * aren't multi-dims, so comments there are view-independent.
 */
export function readCurrentViewState(
    context: CommentPageContext
): CommentViewState | null {
    const { multiDimDimensions, multiDimDefaultView } = context
    if (!multiDimDimensions?.length) return null
    const params = new URLSearchParams(window.location.search)
    const viewState: CommentViewState = { ...multiDimDefaultView }
    for (const { slug } of multiDimDimensions) {
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
 * A stable identity for a view, so threads left on the same view group together.
 * Built in dimension order, and falls back to the raw keys for a view whose
 * dimensions the multi-dim no longer has.
 */
export function viewStateKey(
    viewState: CommentViewState,
    dimensions: CommentMultiDimDimension[]
): string {
    const slugs = dimensions.map((dimension) => dimension.slug)
    const extra = Object.keys(viewState)
        .filter((slug) => !slugs.includes(slug))
        .sort()
    return [...slugs, ...extra]
        .map((slug) => `${slug}=${viewState[slug] ?? ""}`)
        .join("&")
}

/**
 * A view in words, e.g. "Primary school · Girls". Uses the choice names the page
 * itself shows; a choice the multi-dim has since dropped keeps its raw slug
 * rather than disappearing, so an old comment can still be placed.
 */
export function describeViewState(
    viewState: CommentViewState,
    dimensions: CommentMultiDimDimension[]
): string {
    const parts: string[] = []
    for (const dimension of dimensions) {
        const value = viewState[dimension.slug]
        if (value === undefined) continue
        const choice = dimension.choices.find((c) => c.slug === value)
        parts.push(choice?.name ?? value)
    }
    return parts.join(" · ")
}

/**
 * A link to the same page showing the given view. Only the dimension params are
 * replaced, so anything else in the URL (an open tab, a country selection) is
 * carried over. Navigating for real rather than pushing state keeps the overlay
 * decoupled from the multi-dim's router, which lives in a separate React root.
 * Takes the current location rather than reading it, so it stays pure.
 */
export function hrefForViewState(
    viewState: CommentViewState,
    dimensions: CommentMultiDimDimension[],
    currentUrl: { pathname: string; search: string }
): string {
    const params = new URLSearchParams(currentUrl.search)
    for (const { slug } of dimensions) {
        const value = viewState[slug]
        if (value === undefined) params.delete(slug)
        else params.set(slug, value)
    }
    return `${currentUrl.pathname}?${params.toString()}`
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
