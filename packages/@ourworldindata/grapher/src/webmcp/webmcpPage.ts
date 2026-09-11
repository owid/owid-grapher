/**
 * Deciding which Grapher on the page owns the document's WebMCP tools.
 *
 * Tool names are global to the document, so exactly one chart may register.
 * Picking that chart by its render path has now failed twice:
 *
 *  - v1 gated on `renderSingleGrapherOnGrapherPage`, which never runs on the
 *    deployed site — /grapher/<slug> serves a DataPage hydrated by
 *    MultiEmbedder.
 *  - v2 gated inside FetchingGrapher, which multi-dimensional chart pages and
 *    explorers bypass: both render <Grapher> directly. So /grapher/electricity-mix
 *    and every /explorers/ page offered no chart tools at all, and an agent sent
 *    there could neither switch tab nor read a value.
 *
 * So the gate is on the page, and the claim is made from the Grapher component
 * itself — the one thing every chart page mounts, whatever renders it:
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
 *
 * This assumes the claiming Grapher stays mounted for as long as the page does.
 * That holds today: DataPage, MultiDim and Explorer each create one
 * GrapherState and mount <Grapher> once, mutating the state in place. If a
 * chart page ever remounts its Grapher (client-side routing, an error boundary
 * reset), the page would be left without chart tools until reload — release
 * the claim on unmount at that point.
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
