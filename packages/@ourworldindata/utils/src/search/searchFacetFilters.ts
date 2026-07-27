import { Filter, FilterType, SearchFacetFilters } from "@ourworldindata/types"

// Shared between the site's client-side Algolia queries (site/search/queries.ts)
// and the public /api/search Cloudflare function (functions/api/search/searchApi.ts)
// so that identical filters produce identical Algolia requests in both places.

export type SearchFacetAttribute =
    | "tags" // also used on /latest
    | "latestType" // used on /latest only
    | "availableEntities"
    | "datasetProducts"
    | "datasetNamespaces"
    | "datasetVersions"
    | "datasetProducers"

export function getFilterNamesOfType(
    filters: Filter[],
    type: FilterType
): Set<string> {
    return new Set(
        filters
            .filter((filter) => filter.type === type)
            .map((filter) => filter.name)
    )
}

export function setToFacetFilters(
    facetSet: Set<string>,
    attribute: SearchFacetAttribute
): string[] {
    return Array.from(facetSet).map((facet) => `${attribute}:${facet}`)
}

export const formatDisjunctiveFacetFilters = (
    facets: Set<string>,
    attribute: SearchFacetAttribute
): SearchFacetFilters => {
    // disjunction mode (A OR B): [[attribute:"A", attribute:"B"]]
    return [setToFacetFilters(facets, attribute)]
}

export const formatConjunctiveFacetFilters = (
    facets: Set<string>,
    attribute: SearchFacetAttribute
): SearchFacetFilters => {
    // conjunction mode (A AND B): [attribute:"A", attribute:"B"]
    return setToFacetFilters(facets, attribute)
}

/**
 * Returns a facet filter that excludes Featured Metric records when a
 * free-text query is present. When there is no query (e.g. browsing by
 * topic), FMs are kept so they can surface at the top of topic pages.
 */
export function formatFeaturedMetricFacetFilter(
    query: string
): SearchFacetFilters {
    return query.trim() ? ["isFM:false"] : []
}

export function formatCountryFacetFilters(
    countries: Set<string>,
    requireAllCountries: boolean
): SearchFacetFilters {
    const facetFilters: SearchFacetFilters = []
    if (requireAllCountries) {
        facetFilters.push(
            ...formatConjunctiveFacetFilters(countries, "availableEntities")
        )
    } else {
        facetFilters.push(
            ...formatDisjunctiveFacetFilters(countries, "availableEntities")
        )
    }
    // Don't show income group-specific FMs if no countries are selected
    if (!countries.size) {
        facetFilters.push("isIncomeGroupSpecificFM:false")
    }
    return facetFilters
}

export const formatTopicFacetFilters = (
    topics: Set<string>
): SearchFacetFilters => {
    return formatDisjunctiveFacetFilters(topics, "tags")
}
