import {
    dimensionsToViewId,
    extractMultiDimChoicesFromSearchParams,
    MultiDimDataPageConfig,
} from "@ourworldindata/utils"

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
 * resolve to the mdim's default view (the result of getDefaultSelectedChoices()).
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
