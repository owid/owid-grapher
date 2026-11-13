import {
    ChartRecordType,
    OwidGdocType,
    SearchIndexName,
} from "@ourworldindata/types"
import { buildChartsFacetFilters } from "@ourworldindata/utils"
import {
    AlgoliaConfig,
    createSearchClient,
    getIndexName,
} from "../search/algoliaClient.js"
import { ChartHitWithoutId, PageHitWithoutId, RankedHits } from "./aiSearch.js"

// The fields of AiSearchChartCandidate and PageHitWithoutId
const CHART_ATTRIBUTES = [
    "title",
    "slug",
    "type",
    "queryParams",
    "variantName",
    "subtitle",
    "availableTabs",
    "keyChartForTags",
    "numRelatedArticles",
]

const PAGE_ATTRIBUTES = [
    "title",
    "slug",
    "type",
    "thumbnailUrl",
    "authors",
    "date",
    "excerpt",
]

const PAGE_TYPES = [
    OwidGdocType.Article,
    OwidGdocType.TopicPage,
    OwidGdocType.LinearTopicPage,
    OwidGdocType.DataInsight,
]

/** A hit without the attributes Algolia adds to every hit. */
function withoutAlgoliaAttributes<T>(hit: Record<string, unknown>): T {
    const { objectID: _id, _highlightResult, _snippetResult, ...rest } = hit
    return rest as T
}

/**
 * Runs keyword searches for the original query and its expansions in a single
 * Algolia round trip, with the site's ranking. The original query gets the
 * deeper lists, since it supplies three hits per rank to the pool.
 */
export async function searchKeywords(
    config: AlgoliaConfig,
    queries: string[],
    { charts, pages }: { charts: number; pages: number }
): Promise<RankedHits[]> {
    const client = createSearchClient(config)
    const chartsIndex = getIndexName(
        SearchIndexName.ExplorerViewsMdimViewsAndCharts,
        config.indexPrefix
    )
    const pagesIndex = getIndexName(SearchIndexName.Pages, config.indexPrefix)
    const pageFilters = PAGE_TYPES.map((type) => `type:${type}`).join(" OR ")

    const requests = queries.flatMap((query, i) => {
        const share = i === 0 ? 1 : 1 / 3
        return [
            {
                indexName: chartsIndex,
                query,
                attributesToRetrieve: CHART_ATTRIBUTES,
                attributesToHighlight: [],
                attributesToSnippet: [],
                hitsPerPage: Math.ceil(charts * share),
                facetFilters: buildChartsFacetFilters({
                    query,
                    filters: [],
                    requireAllCountries: false,
                }),
            },
            {
                indexName: pagesIndex,
                query,
                attributesToRetrieve: PAGE_ATTRIBUTES,
                attributesToHighlight: [],
                attributesToSnippet: [],
                hitsPerPage: Math.ceil(pages * share),
                filters: pageFilters,
            },
        ]
    })

    const { results } = await client.searchForHits<Record<string, unknown>>({
        requests,
    })

    return queries.map((_, i) => ({
        charts: (results[2 * i]?.hits ?? [])
            .map((hit) => withoutAlgoliaAttributes<ChartHitWithoutId>(hit))
            .filter((hit) => Object.values(ChartRecordType).includes(hit.type)),
        pages: (results[2 * i + 1]?.hits ?? []).map((hit) =>
            withoutAlgoliaAttributes<PageHitWithoutId>(hit)
        ),
    }))
}
