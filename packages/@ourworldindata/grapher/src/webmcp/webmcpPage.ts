/**
 * Deciding which Grapher on the page owns the document's WebMCP tools.
 *
 * Tool names are global to the document, so exactly one chart may register.
 * v1 gated this on `renderSingleGrapherOnGrapherPage`, which turned out never
 * to run on the deployed site: /grapher/<slug> serves a DataPage whose chart is
 * hydrated by MultiEmbedder, so no chart tools were ever registered and the
 * agent was left with only the site-wide ones.
 *
 * So the gate is now on the page, not the render path:
 *
 *  - the URL must be a chart page (/grapher/… or /explorers/…), which excludes
 *    articles and data-insight pages that embed many charts;
 *  - the first Grapher to actually mount claims the tools. A DataPage carries a
 *    second, `display: none` figure for iframe embeds, and Grapher skips
 *    rendering hidden containers (see `renderGrapherIntoContainer`), so the
 *    claim lands on the chart the reader is looking at.
 */

const CHART_PAGE_PATH_PREFIXES = ["/grapher/", "/explorers/"]

export function isPrimaryChartPage(): boolean {
    if (typeof window === "undefined") return false
    return CHART_PAGE_PATH_PREFIXES.some((prefix) =>
        window.location.pathname.startsWith(prefix)
    )
}

let toolsClaimed = false

/**
 * Returns true for the first caller only. Releasing on unmount would let a
 * remounting chart re-claim, but it would also let a *second* chart claim while
 * the first is still on screen, so the claim is deliberately one-way for the
 * lifetime of the document.
 */
export function claimDocumentTools(): boolean {
    if (toolsClaimed) return false
    toolsClaimed = true
    return true
}

/** Test seam. */
export function resetDocumentToolClaim(): void {
    toolsClaimed = false
}
