import { Filter, FilterType } from "@ourworldindata/types"
import { getFilterNamesOfType } from "./searchFacetFilters.js"

// Typesense `filter_by` counterparts of the Algolia `facetFilters` builders in
// searchFacetFilters.ts. Shared between the site's client-side queries
// (site/search/queries.ts) and the public /api/search Cloudflare function
// (functions/api/search/searchApi.ts) for the same reason the Algolia ones are:
// so identical filters produce identical requests in both places.
//
// Every value is wrapped in backticks, which is how Typesense escapes filter
// literals containing spaces, commas or brackets ("Côte d'Ivoire", "Health &
// Medicine"). `:=` is exact match — the equivalent of an Algolia facet filter,
// as opposed to `:` which does a substring/token match.

export type TypesenseFilterAttribute =
    | "tags"
    | "availableEntities"
    | "datasetProducts"
    | "datasetNamespaces"
    | "datasetVersions"
    | "datasetProducers"

function escape(value: string): string {
    return "`" + value + "`"
}

/**
 * Disjunction (A OR B): `attribute:=[`A`, `B`]`.
 * Returns undefined for an empty set so callers can drop the clause entirely —
 * an empty `filter_by` term is a Typesense parse error, not a no-op.
 */
export function formatDisjunctiveFilterBy(
    values: Set<string>,
    attribute: TypesenseFilterAttribute
): string | undefined {
    if (values.size === 0) return undefined
    const escaped = Array.from(values).map(escape).join(", ")
    return `${attribute}:=[${escaped}]`
}

/** Conjunction (A AND B): one clause per value, `&&`-joined. */
export function formatConjunctiveFilterBy(
    values: Set<string>,
    attribute: TypesenseFilterAttribute
): string | undefined {
    if (values.size === 0) return undefined
    return Array.from(values)
        .map((value) => `${attribute}:=${escape(value)}`)
        .join(" && ")
}

export function formatCountryFilterBy(
    countries: Set<string>,
    requireAllCountries: boolean
): (string | undefined)[] {
    const clauses: (string | undefined)[] = [
        requireAllCountries
            ? formatConjunctiveFilterBy(countries, "availableEntities")
            : formatDisjunctiveFilterBy(countries, "availableEntities"),
    ]
    // Don't show income group-specific FMs if no countries are selected.
    if (!countries.size) clauses.push("isIncomeGroupSpecificFM:=false")
    return clauses
}

export function formatTopicFilterBy(topics: Set<string>): string | undefined {
    return formatDisjunctiveFilterBy(topics, "tags")
}

/**
 * Excludes Featured Metric records when a free-text query is present. When
 * there is no query (e.g. browsing by topic), FMs are kept so they can surface
 * at the top of topic pages.
 */
export function formatFeaturedMetricFilterBy(
    query: string
): string | undefined {
    return query.trim() ? "isFM:=false" : undefined
}

/** Combine clauses into one `filter_by` string, dropping empty ones. */
export function joinFilterBy(...clauses: (string | undefined)[]): string {
    return clauses.filter(Boolean).join(" && ")
}

/** `type:=X`, or `type:=[X, Y]` for several. */
export function formatTypeFilterBy(...types: string[]): string {
    if (types.length === 1) return `type:=${escape(types[0])}`
    return `type:=[${types.map(escape).join(", ")}]`
}

/**
 * Builds the full `filter_by` string for a charts-collection search: country,
 * topic, dataset facets (site-only for now — the public API doesn't expose
 * dataset filters), then the Featured Metric exclusion.
 *
 * The Typesense twin of `buildChartsFacetFilters`; both the site's queryCharts
 * and /api/search's searchCharts call this one.
 */
export function buildChartsFilterBy(params: {
    query: string
    filters: Filter[]
    requireAllCountries: boolean
    datasetFilterBy?: (string | undefined)[]
}): string {
    return joinFilterBy(
        ...formatCountryFilterBy(
            getFilterNamesOfType(params.filters, FilterType.COUNTRY),
            params.requireAllCountries
        ),
        formatTopicFilterBy(
            getFilterNamesOfType(params.filters, FilterType.TOPIC)
        ),
        ...(params.datasetFilterBy ?? []),
        formatFeaturedMetricFilterBy(params.query)
    )
}
