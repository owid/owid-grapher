import { GRAPHER_LOADING_STATE_EVENT_NAME } from "@ourworldindata/grapher"

declare global {
    interface Window {
        _OWID_GRAPHERS_LOADING?: number
        _OWID_HAVE_ALL_GRAPHERS_LOADED?: boolean
    }
}

interface GrapherLoadingStateEventDetail {
    grapher: unknown
    isLoading: boolean
}

/**
 * Tracks how many graphers on the page are loading right now, for tools that drive the
 * page and need to wait until the charts have been drawn - the site-screenshots tool,
 * mainly. We expose this on the window instead of dispatching an event, because a page
 * can finish loading before the script that would listen for it has run.
 *
 * Graphers load lazily as they scroll into view, so a count of zero means "nothing that
 * has started loading is still loading", not "every chart on the page has drawn". There
 * is no way to know the latter up front: a chart is baked as a static fallback and only
 * becomes a grapher once something hydrates it, and some fallbacks (the thumbnails in a
 * key indicator collection, say) stay static until the reader interacts with them. A
 * caller that wants every chart drawn therefore has to scroll the page and then wait for
 * the count to stay at zero.
 */
export function runAllGraphersLoadedListener(): void {
    const loadingGraphers = new Set<unknown>()
    window._OWID_GRAPHERS_LOADING = 0
    window._OWID_HAVE_ALL_GRAPHERS_LOADED = true

    document.addEventListener(GRAPHER_LOADING_STATE_EVENT_NAME, (event) => {
        const { grapher, isLoading } = (
            event as CustomEvent<GrapherLoadingStateEventDetail>
        ).detail

        // Count graphers rather than events: a grapher announces itself again every time
        // it is re-rendered, which the ResizeObserver in GrapherUseHelpers does whenever
        // it measures the container again
        if (isLoading) loadingGraphers.add(grapher)
        else loadingGraphers.delete(grapher)

        window._OWID_GRAPHERS_LOADING = loadingGraphers.size
        window._OWID_HAVE_ALL_GRAPHERS_LOADED = loadingGraphers.size === 0
    })
}
