import {
    dimensionsToViewId,
    extractMultiDimChoicesFromSearchParams,
    MultiDimDataPageConfig,
} from "@ourworldindata/utils"
import { MultiDimRedirectWithLookupKey } from "./context.js"

/**
 * Builds a deterministic queryStr for a set of dimension choices. Dimensions
 * are sorted alphabetically by key so equivalent choice sets always produce
 * the same string regardless of insertion order.
 */
export function dimensionsToSortedQueryStr(
    dimensions: Record<string, string>
): string {
    const sortedDimensions = Object.entries(dimensions).sort(([keyA], [keyB]) =>
        keyA.localeCompare(keyB)
    )
    const params = new URLSearchParams()
    for (const [dimension, choice] of sortedDimensions) {
        params.set(dimension, choice)
    }
    return params.toString()
}

/**
 * Attributes each gdoc link to the specific mdim view its query string
 * resolves to, returning a viewId → count map.
 * Links whose query string is empty or doesn't match any dimension choices
 * resolve to the mdim's default view (the result of filterToAvailableChoices({}).selectedChoices).
 */
export function attributeLinksToViewIds(
    links: { queryString: string | null }[],
    mdimConfig: MultiDimDataPageConfig
): Map<string, number> {
    const result = new Map<string, number>()
    for (const link of links) {
        const searchParams = new URLSearchParams(link.queryString ?? "")
        const dimensionChoices = extractMultiDimChoicesFromSearchParams(
            searchParams,
            mdimConfig
        )
        const resolvedChoices =
            mdimConfig.filterToAvailableChoices(
                dimensionChoices
            ).selectedChoices
        const viewId = dimensionsToViewId(resolvedChoices)
        result.set(viewId, (result.get(viewId) ?? 0) + 1)
    }
    return result
}

/**
 * Groups redirects by the queryStr of the view they target, so each multi-dim view
 * can find the predecessors that should contribute their pageviews to it. A
 * redirect with no targetQueryStr is treated as targeting the multi-dim's default
 * view, identified by the supplied defaultViewQueryStr.
 */
export function bucketPredecessorsByQueryStr(
    redirects: MultiDimRedirectWithLookupKey[],
    defaultViewQueryStr: string
): Map<string, MultiDimRedirectWithLookupKey[]> {
    const result = new Map<string, MultiDimRedirectWithLookupKey[]>()
    for (const redirect of redirects) {
        const key = redirect.targetQueryStr ?? defaultViewQueryStr
        const list = result.get(key)
        if (list) list.push(redirect)
        else result.set(key, [redirect])
    }
    return result
}

/**
 * Returns the views_7d an mdim view should report, inheriting from its
 * predecessors. Takes the max of the view's own count and each resolvable
 * predecessor's count.
 */
export function inheritMaxViewsFromPredecessors(
    ownViews_7d: number,
    predecessors: MultiDimRedirectWithLookupKey[],
    viewsLookup: Map<string, number>
): number {
    return predecessors.reduce(
        (max, pred) =>
            pred.lookupKey
                ? Math.max(max, viewsLookup.get(pred.lookupKey) ?? 0)
                : max,
        ownViews_7d
    )
}
