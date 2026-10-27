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
import { ChartCandidate, PageCandidate, RankedHits } from "./aiSearch.js"

// What the search result components need (DATA_CATALOG_ATTRIBUTES on the
// site), plus ranking hints for the model
const CHART_ATTRIBUTES = [
    "title",
    "containerTitle",
    "slug",
    "availableEntities",
    "originalAvailableEntities",
    "variantName",
    "titleVariant",
    "type",
    "queryParams",
    "availableTabs",
    "subtitle",
    "chartConfigId",
    "explorerType",
    "keyChartForTags",
    "numRelatedArticles",
]

const PAGE_ATTRIBUTES = [
    "title",
    "slug",
    "type",
    "thumbnailUrl",
    "date",
    "authors",
    "excerpt",
    "excerptLong",
]

const PAGE_TYPES = [
    OwidGdocType.Article,
    OwidGdocType.TopicPage,
    OwidGdocType.LinearTopicPage,
    OwidGdocType.DataInsight,
]

/** A hit without the highlighting Algolia adds to every hit */
function withoutHighlights<T>(hit: Record<string, unknown>): T {
    const { _highlightResult, _snippetResult, ...rest } = hit
    return rest as T
}

/**
 * Keeps the content snippet, which SearchFlatArticleHit shows for an article
 * without an excerpt
 */
function withContentSnippet<T>(hit: Record<string, unknown>): T {
    const { _highlightResult, ...rest } = hit
    return rest as T
}

/**
 * Runs keyword searches for the original query and its expansions in a single
 * Algolia round trip, with the site's ranking. The original query gets the
 * deeper lists, since it supplies more hits per rank to the pool.
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
                attributesToSnippet: ["content:20"],
                highlightPreTag: "<mark>",
                highlightPostTag: "</mark>",
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
            .map((hit) => withoutHighlights<ChartCandidate>(hit))
            .filter((hit) => Object.values(ChartRecordType).includes(hit.type)),
        pages: (results[2 * i + 1]?.hits ?? []).map((hit) =>
            withContentSnippet<PageCandidate>(hit)
        ),
    }))
}
