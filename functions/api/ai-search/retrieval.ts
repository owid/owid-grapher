import {
    ChartRecordType,
    Filter,
    FilterType,
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
    "availableEntities",
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
 * deeper lists, since it supplies three hits per rank to the pool. Country
 * and topic filters from the search box apply to the chart searches, as on
 * the standard results.
 */
export async function searchKeywords(
    config: AlgoliaConfig,
    queries: string[],
    { charts, pages }: { charts: number; pages: number },
    {
        countries = [],
        topics = [],
    }: { countries?: string[]; topics?: string[] } = {}
): Promise<RankedHits[]> {
    const filters: Filter[] = [
        ...countries.map((name) => ({ type: FilterType.COUNTRY, name })),
        ...topics.map((name) => ({ type: FilterType.TOPIC, name })),
    ]
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
                    filters,
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

// The topics whose featured metrics we recommend for a country on its own
export const CORE_COUNTRY_TOPICS = [
    "Population Growth",
    "Life Expectancy",
    "Economic Growth",
    "Poverty",
    "Child & Infant Mortality",
    "Global Education",
    "CO2 & Greenhouse Gas Emissions",
    "Energy",
]

export interface CuratedHits {
    topics: { name: string; charts: ChartHitWithoutId[] }[]
    pages: PageHitWithoutId[]
}

/**
 * OWID's own picks for a search: the featured metrics our researchers chose
 * for each topic (in their curated order), the country's profile pages and
 * the topics' main pages. Featured metrics only surface in a search with no
 * text, so each topic gets a text-free search filtered to that topic, and to
 * the countries when there are any.
 */
export async function searchCurated(
    config: AlgoliaConfig,
    {
        topics,
        countries,
        perTopic,
        withTopicPages,
    }: {
        topics: string[]
        countries: string[]
        perTopic: number
        // A country's own profiles say more than general topic pages
        withTopicPages: boolean
    }
): Promise<CuratedHits> {
    const client = createSearchClient(config)
    const chartsIndex = getIndexName(
        SearchIndexName.ExplorerViewsMdimViewsAndCharts,
        config.indexPrefix
    )
    const pagesIndex = getIndexName(SearchIndexName.Pages, config.indexPrefix)
    const countryFilters: Filter[] = countries.map((name) => ({
        type: FilterType.COUNTRY,
        name,
    }))

    const chartRequests = topics.map((topic) => ({
        indexName: chartsIndex,
        query: "",
        attributesToRetrieve: CHART_ATTRIBUTES,
        attributesToHighlight: [],
        attributesToSnippet: [],
        // Fetch extra to make up for duplicates across income groups
        hitsPerPage: perTopic * 2,
        facetFilters: [
            "isFM:true",
            ...buildChartsFacetFilters({
                query: "",
                filters: [
                    ...countryFilters,
                    { type: FilterType.TOPIC, name: topic },
                ],
                requireAllCountries: false,
            }),
        ],
    }))
    const profileRequests = countries.map((country) => ({
        indexName: pagesIndex,
        query: country,
        attributesToRetrieve: PAGE_ATTRIBUTES,
        attributesToHighlight: [],
        attributesToSnippet: [],
        hitsPerPage: 12,
        filters: `type:${OwidGdocType.Profile}`,
    }))
    const topicPageTopics = withTopicPages ? topics.slice(0, 3) : []
    const topicPageRequests = topicPageTopics.map((topic) => ({
        indexName: pagesIndex,
        query: topic,
        attributesToRetrieve: PAGE_ATTRIBUTES,
        attributesToHighlight: [],
        attributesToSnippet: [],
        hitsPerPage: 1,
        filters: `type:${OwidGdocType.TopicPage} OR type:${OwidGdocType.LinearTopicPage}`,
    }))

    const { results } = await client.searchForHits<Record<string, unknown>>({
        requests: [...chartRequests, ...profileRequests, ...topicPageRequests],
    })
    const hitsAt = (i: number): Record<string, unknown>[] =>
        results[i]?.hits ?? []

    const seen = new Set<string>()
    const curatedTopics = topics
        .map((name, i) => {
            const charts = hitsAt(i)
                .map((hit) => withoutAlgoliaAttributes<ChartHitWithoutId>(hit))
                .filter((hit) => {
                    const key = `${hit.slug}${hit.queryParams ?? ""}`
                    if (seen.has(key)) return false
                    seen.add(key)
                    return true
                })
                .slice(0, perTopic)
            return { name, charts }
        })
        .filter((topic) => topic.charts.length > 0)

    // A search for "Niger" also finds Nigeria's profiles: keep only the
    // profiles of the countries themselves ("Health in Niger")
    const profiles = countries.flatMap((country, i) =>
        hitsAt(topics.length + i)
            .map((hit) => withoutAlgoliaAttributes<PageHitWithoutId>(hit))
            .filter((page) => {
                const title = page.title.toLowerCase()
                const name = country.toLowerCase()
                return (
                    title.endsWith(` in ${name}`) ||
                    title.endsWith(` in the ${name}`)
                )
            })
    )
    const topicPages = topicPageTopics.flatMap((_, i) =>
        hitsAt(topics.length + countries.length + i).map((hit) =>
            withoutAlgoliaAttributes<PageHitWithoutId>(hit)
        )
    )

    return { topics: curatedTopics, pages: [...profiles, ...topicPages] }
}
