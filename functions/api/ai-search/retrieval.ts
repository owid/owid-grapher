import {
    ChartRecordType,
    OwidGdocType,
    SearchChartHit,
    SearchIndexName,
} from "@ourworldindata/types"
import {
    AlgoliaConfig,
    createSearchClient,
    getIndexName,
} from "../search/algoliaClient.js"
import { ChartHitWithoutId, PageHitWithoutId, RankedHits } from "./aiSearch.js"

const CHART_ATTRIBUTES = [
    "title",
    "containerTitle",
    "slug",
    "type",
    "queryParams",
    "variantName",
    "titleVariant",
    "subtitle",
    "availableTabs",
    "keyChartForTags",
    "numRelatedArticles",
    "explorerType",
    "chartConfigId",
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

type ChartRecordHit = SearchChartHit & {
    keyChartForTags?: string[]
    numRelatedArticles?: number
}

function toChartHit(hit: ChartRecordHit): ChartHitWithoutId {
    const {
        __position: _position,
        _highlightResult,
        _snippetResult,
        ...rest
    } = hit
    // availableEntities isn't retrieved: the prompt doesn't use it and it's
    // the bulk of a record.
    return { ...rest, availableEntities: [] }
}

function toPageHit(hit: Record<string, unknown>): PageHitWithoutId {
    return {
        title: String(hit.title),
        slug: String(hit.slug),
        type: hit.type as OwidGdocType,
        thumbnailUrl: hit.thumbnailUrl as string | undefined,
        authors: hit.authors as string[] | undefined,
        date: hit.date as string | undefined,
        excerpt: hit.excerpt as string | undefined,
    }
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
                // Income-group-specific featured metrics duplicate their
                // parent chart in a plain search.
                facetFilters: ["isIncomeGroupSpecificFM:false"],
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
            .map((hit) => toChartHit(hit as unknown as ChartRecordHit))
            .filter((hit) => Object.values(ChartRecordType).includes(hit.type)),
        pages: (results[2 * i + 1]?.hits ?? []).map(toPageHit),
    }))
}
