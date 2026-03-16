import {
    SearchIndexName,
    FilterType,
    Filter,
    ChartRecordType,
    SearchChartHit,
} from "@ourworldindata/types"
import {
    TypesenseConfig,
    TypesenseHit,
    TypesenseSearchResponse,
    typesenseSearch,
} from "./typesenseClient.js"

/** Default hybrid search alpha: 70% keyword, 30% vector. */
export const DEFAULT_ALPHA = 0.3

/**
 * Enriched search result with URL added.
 * This is what we return from the API after processing Typesense results.
 */
export type EnrichedSearchChartHit = Omit<
    SearchChartHit,
    "objectID" | "_highlightResult" | "_snippetResult"
> & {
    url: string
}

/**
 * Enriched page search result with URL added.
 */
export interface EnrichedSearchPageHit {
    title: string
    slug: string
    type: string
    thumbnailUrl?: string
    date?: string
    content?: string
    authors?: string[]
    url: string
}

export interface SearchState {
    query: string
    filters: Filter[]
    requireAllCountries: boolean
}

export interface SearchApiResponse {
    query: string
    results: EnrichedSearchChartHit[]
    nbHits: number
    page: number
    nbPages: number
    hitsPerPage: number
}

export interface SearchPagesApiResponse {
    query: string
    results: EnrichedSearchPageHit[]
    nbHits: number
    offset: number
    length: number
}

// Minimal set of attributes needed by the API consumers
const CHART_INCLUDE_FIELDS = [
    "title",
    "containerTitle",
    "slug",
    "subtitle",
    "variantName",
    "type",
    "queryParams",
    "availableEntities",
    "originalAvailableEntities",
    "availableTabs",
    "publishedAt",
    "updatedAt",
].join(",")

const CHARTS_QUERY_BY =
    "embedding,title,slug,subtitle,variantName,tags,availableEntities,originalAvailableEntities"

const PAGE_INCLUDE_FIELDS = [
    "title",
    "thumbnailUrl",
    "date",
    "slug",
    "type",
    "content",
    "authors",
    "modifiedDate",
].join(",")

const PAGES_QUERY_BY = "embedding,title,excerpt,tags,authors,content"

// ── Filter helpers ──────────────────────────────────────────────────────

function getFilterNamesOfType(
    filters: Filter[],
    type: FilterType
): Set<string> {
    return new Set(filters.filter((f) => f.type === type).map((f) => f.name))
}

/** Typesense filter expression for countries. */
export function formatCountryFilter(
    countries: Set<string>,
    requireAll: boolean
): string | undefined {
    if (countries.size === 0) return undefined

    const escaped = Array.from(countries).map((c) => "`" + c + "`")

    if (requireAll) {
        // Conjunction: each country as separate filter joined with &&
        return escaped
            .map((country) => `availableEntities:=${country}`)
            .join(" && ")
    }
    // Disjunction: array syntax
    return `availableEntities:=[${escaped.join(", ")}]`
}

/** Typesense filter expression for topics (OR logic). */
export function formatTopicFilter(topics: Set<string>): string | undefined {
    if (topics.size === 0) return undefined
    const escaped = Array.from(topics).map((t) => "`" + t + "`")
    return `tags:=[${escaped.join(", ")}]`
}

/**
 * Exclude Featured Metric records when a free-text query is present.
 * When browsing by topic (no query), FMs are kept.
 */
export function formatFeaturedMetricFilter(query: string): string | undefined {
    return query.trim() ? "isFM:!=true" : undefined
}

/** Exclude income-group-specific FMs when no countries are selected. */
export function formatIncomeGroupFMFilter(
    countries: Set<string>
): string | undefined {
    return countries.size === 0 ? "isIncomeGroupSpecificFM:!=true" : undefined
}

/** Join non-undefined filter parts with " && ". */
function buildFilterBy(...parts: (string | undefined)[]): string {
    return parts.filter(Boolean).join(" && ")
}

// ── Helpers to extract hits from grouped or ungrouped responses ─────────

function extractHits<T>(
    response: TypesenseSearchResponse<T>
): TypesenseHit<T>[] {
    return (
        response.hits ??
        response.grouped_hits?.flatMap((group) => group.hits ?? []) ??
        []
    )
}

// ── Chart search ────────────────────────────────────────────────────────

export async function searchCharts(
    config: TypesenseConfig,
    state: SearchState,
    page: number = 0,
    hitsPerPage: number = 20,
    baseUrl: string = "https://ourworldindata.org",
    alpha: number = DEFAULT_ALPHA
): Promise<SearchApiResponse> {
    const selectedCountries = getFilterNamesOfType(
        state.filters,
        FilterType.COUNTRY
    )
    const selectedTopics = getFilterNamesOfType(state.filters, FilterType.TOPIC)

    const query = state.query || "*"
    const isWildcard = query === "*"

    const filterBy = buildFilterBy(
        formatCountryFilter(selectedCountries, state.requireAllCountries),
        formatTopicFilter(selectedTopics),
        formatFeaturedMetricFilter(state.query),
        formatIncomeGroupFMFilter(selectedCountries)
    )

    const params: Record<string, string | undefined> = {
        q: query,
        query_by: CHARTS_QUERY_BY,
        vector_query: !isWildcard
            ? `embedding:([], k:100, alpha:${alpha})`
            : undefined,
        prefix: "false",
        include_fields: CHART_INCLUDE_FIELDS,
        highlight_start_tag: "<mark>",
        highlight_end_tag: "</mark>",
        group_by: "deduplicationId",
        group_limit: "1",
        per_page: hitsPerPage.toString(),
        page: (page + 1).toString(), // Typesense pages are 1-indexed
        filter_by: filterBy || undefined,
    }

    const collection = SearchIndexName.ExplorerViewsMdimViewsAndCharts
    const response = await typesenseSearch(config, collection, params)

    const rawHits = extractHits(response)
    const cleanedHits = rawHits.map((hit, index): EnrichedSearchChartHit => {
        const doc = hit.document as Record<string, unknown>

        let url: string
        if (doc.type === ChartRecordType.ExplorerView) {
            const queryParams = (doc.queryParams as string) || ""
            url = `${baseUrl}/explorers/${doc.slug}${queryParams}`
        } else if (doc.type === ChartRecordType.MultiDimView) {
            const queryParams = (doc.queryParams as string) || ""
            url = `${baseUrl}/grapher/${doc.slug}${queryParams}`
        } else {
            url = `${baseUrl}/grapher/${doc.slug}`
        }

        return {
            ...(doc as unknown as SearchChartHit),
            url,
            __position: page * hitsPerPage + index,
        }
    })

    const nbPages = Math.ceil(response.found / hitsPerPage)

    return {
        query: state.query,
        results: cleanedHits,
        nbHits: response.found,
        page,
        nbPages,
        hitsPerPage,
    }
}

// ── Page search ─────────────────────────────────────────────────────────

export async function searchPages(
    config: TypesenseConfig,
    query: string,
    offset: number = 0,
    length: number = 10,
    pageTypes: string[] = ["article", "about-page"],
    baseUrl: string = "https://ourworldindata.org",
    alpha: number = DEFAULT_ALPHA
): Promise<SearchPagesApiResponse> {
    const collection = SearchIndexName.Pages
    const q = query || "*"
    const isWildcard = q === "*"

    // Build type filter: type:=[article, about-page]
    const typeFilter =
        pageTypes.length === 1
            ? `type:=${pageTypes[0]}`
            : `type:=[${pageTypes.join(", ")}]`

    const params: Record<string, string | undefined> = {
        q,
        query_by: PAGES_QUERY_BY,
        vector_query: !isWildcard
            ? `embedding:([], k:100, alpha:${alpha})`
            : undefined,
        prefix: "false",
        include_fields: PAGE_INCLUDE_FIELDS,
        highlight_start_tag: "<mark>",
        highlight_end_tag: "</mark>",
        group_by: "slug",
        group_limit: "1",
        filter_by: typeFilter,
        offset: offset.toString(),
        limit: length.toString(),
    }

    const response = await typesenseSearch(config, collection, params)

    const rawHits = extractHits(response)
    const cleanedHits = rawHits.map((hit): EnrichedSearchPageHit => {
        const doc = hit.document as Record<string, unknown>
        return {
            title: doc.title as string,
            slug: doc.slug as string,
            type: doc.type as string,
            thumbnailUrl: doc.thumbnailUrl as string | undefined,
            date: doc.date as string | undefined,
            content: doc.content as string | undefined,
            authors: doc.authors as string[] | undefined,
            url: `${baseUrl}/${doc.slug}`,
        }
    })

    return {
        query,
        results: cleanedHits,
        nbHits: response.found,
        offset,
        length,
    }
}
