import {
    CommentTarget,
    CommentTargetType,
    CommentViewState,
    DataPageDataV2,
} from "@ourworldindata/types"
import {
    CommentField,
    chartCommentFields,
    indicatorCommentFields,
} from "./commentFields.js"

/**
 * A multi-dim dimension, reduced to what the overlay needs: the slug to read the
 * view out of the URL, and names to say in words which view a comment sits on.
 */
export interface CommentMultiDimDimension {
    slug: string
    name: string
    choices: { slug: string; name: string }[]
}

/**
 * What a page lets staff comment on. Serialized by the page renderers (only when
 * previewing) so the overlay never has to infer it from the grapher config.
 *
 * Indicators are deliberately not targets. Every field on the page - including
 * the indicator metadata a data page shows - is commented on as this chart or
 * view presents it, so a comment never spreads to unrelated charts that happen
 * to use the same indicator.
 */
export interface CommentPageContext {
    /** The chart or multi-dim every comment on this page is attached to */
    target: CommentTarget
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
    multiDim,
    datapageData,
}: {
    chartId?: number
    multiDim?: {
        id: number
        dimensions: CommentMultiDimDimension[]
        defaultView?: CommentViewState
    }
    datapageData?: DataPageDataV2
}): CommentPageContext | undefined {
    // Without a chart or a multi-dim there is nothing a comment could attach
    // to, so the page gets no commenting at all. That is the case for an
    // indicator's own data page preview.
    let target: CommentTarget
    if (multiDim)
        target = {
            targetType: CommentTargetType.MultiDim,
            targetId: multiDim.id,
        }
    else if (chartId !== undefined)
        target = { targetType: CommentTargetType.Chart, targetId: chartId }
    else return undefined

    const chartLevel = chartCommentFields()
    const indicatorLevel = datapageData
        ? indicatorCommentFields(datapageData)
        : []

    return {
        target,
        fields: [...chartLevel, ...indicatorLevel],
        multiDimDimensions: multiDim?.dimensions,
        multiDimDefaultView: multiDim?.defaultView,
    }
}

export function getCommentPageContext(): CommentPageContext | undefined {
    const context = window._OWID_COMMENT_CONTEXT
    return context?.target ? context : undefined
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

/** An unresolved cluster of comments sitting on a view that isn't on screen */
export interface OtherViewComments {
    key: string
    /** The view in words, e.g. "Primary school · Girls" */
    label: string
    href: string
    count: number
}

/**
 * The views holding the given comments, minus the one on screen. Takes bare view
 * states so the same grouping serves the whole page and a single field, and stays
 * pure enough to test. Comments with no view (indicator metadata, which every
 * view shares) are never "elsewhere".
 */
export function groupOtherViews(
    viewStates: (CommentViewState | null)[],
    currentViewState: CommentViewState | null,
    dimensions: CommentMultiDimDimension[],
    currentUrl: { pathname: string; search: string }
): OtherViewComments[] {
    if (!dimensions.length) return []
    const byKey = new Map<string, OtherViewComments>()
    for (const viewState of viewStates) {
        if (!viewState) continue
        if (isSameViewState(viewState, currentViewState)) continue
        const key = viewStateKey(viewState, dimensions)
        const existing = byKey.get(key)
        if (existing) {
            existing.count += 1
            continue
        }
        byKey.set(key, {
            key,
            label: describeViewState(viewState, dimensions) || "Another view",
            href: hrefForViewState(viewState, dimensions, currentUrl),
            count: 1,
        })
    }
    return [...byKey.values()].sort(
        (a, b) => b.count - a.count || a.label.localeCompare(b.label)
    )
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
