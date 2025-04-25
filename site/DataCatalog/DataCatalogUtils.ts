import {
    HitHighlightResult,
    SearchForFacetValuesResponse,
    SearchResponse,
} from "instantsearch.js"
import { getIndexName, parseIndexName } from "../search/searchClient.js"
import {
    ChartRecordType,
    indexNameToSubdirectoryMap,
    IPageHit,
    SearchIndexName,
    WordpressPageType,
} from "../search/searchTypes.js"
import { TagGraphNode, TagGraphRoot, OwidGdocType } from "@ourworldindata/types"
import {
    CatalogComponentId,
    DataCatalogState,
    CatalogFilterType,
    DEFAULT_COMPONENTS,
} from "./DataCatalogState.js"
import {
    countriesByName,
    flattenNonTopicNodes,
    Region,
} from "@ourworldindata/utils"
import algoliasearch, { SearchClient } from "algoliasearch"
import { SiteAnalytics } from "../SiteAnalytics.js"
import { BaseItem } from "./DataCatalogAutocomplete.js"
import {
    ALGOLIA_ID,
    ALGOLIA_SEARCH_KEY,
} from "../../settings/clientSettings.js"
import { AutocompleteState } from "@algolia/autocomplete-js"

/**
 * Constants
 */
const CHARTS_INDEX = getIndexName(
    SearchIndexName.ExplorerViewsMdimViewsAndCharts
)

const DATA_CATALOG_ATTRIBUTES = [
    "title",
    "slug",
    "availableEntities",
    "variantName",
    "type",
    "queryParams",
]

/**
 * Types
 */

/**
 * This is a type that algolia doesn't export but is necessary to work with the algolia client
 * Effectively the same as Awaited<ReturnType<SearchClient["search"]>>, but generic
 */
type MultipleQueriesResponse<TObject> = {
    results: Array<SearchResponse<TObject> | SearchForFacetValuesResponse>
}

/**
 * This is the type for the hits that we get back from algolia when we search
 * response.results[0].hits is an array of these
 */
export type IDataCatalogHit = {
    title: string
    slug: string
    availableEntities: string[]
    objectID: string
    variantName: string | null
    type: ChartRecordType
    queryParams: string
    __position: number
    _highlightResult?: HitHighlightResult
    _snippetResult?: HitHighlightResult
}

// SearchResponse adds the extra fields from Algolia: page, nbHits, etc
export type DataCatalogSearchResult = SearchResponse<IDataCatalogHit>

// We add a title field to the SearchResponse for the ribbons
export type DataCatalogRibbonResult = SearchResponse<IDataCatalogHit> & {
    title: string
}

export type DataCatalogResearchSearchResult = SearchResponse<IPageHit>

export type DataCatalogResearchRibbonResult = SearchResponse<IPageHit> & {
    title: string
}

export type DataCatalogCache = {
    ribbons: Map<string, DataCatalogRibbonResult[]>
    search: Map<string, DataCatalogSearchResult>
    pages: Map<string, DataCatalogResearchSearchResult>
    research: Map<string, DataCatalogResearchSearchResult>
    researchRibbons: Map<string, DataCatalogResearchRibbonResult[]>
}

export enum AutocompleteSources {
    RECENT_SEARCHES = "recentSearches",
    SUGGESTED_SEARCH = "suggestedSearch",
    AUTOCOMPLETE = "autocomplete",
    COUNTRIES = "countries",
    TOPICS = "topics",
    COMBINED_FILTERS = "combinedFilters",
    CURRENT_QUERY = "runSearch",
}

export enum AutocompleteItemType {
    Country = WordpressPageType.Country,
    TopicPage = OwidGdocType.TopicPage,
    LinearTopicPage = OwidGdocType.LinearTopicPage,
    Chart = ChartRecordType.Chart,
    ExplorerView = ChartRecordType.ExplorerView,
    MultiDimView = ChartRecordType.MultiDimView,
    Featured = "featured",
    CurrentQuery = "currentQuery",
}

/**
 * Utils
 */
export function getFiltersOfType(
    state: DataCatalogState,
    type: CatalogFilterType
): Set<string> {
    return new Set(
        state.filters.filter((f) => f.type === type).map((f) => f.name)
    )
}

function checkIfNoTopicsOrOneAreaTopicApplied(
    topics: Set<string>,
    areas: string[]
) {
    if (topics.size === 0) return true
    if (topics.size > 1) return false

    const [tag] = topics.values()
    return areas.includes(tag)
}

export function checkShouldShowRibbonView(
    query: string,
    topics: Set<string>,
    areaNames: string[]
): boolean {
    return (
        query === "" && checkIfNoTopicsOrOneAreaTopicApplied(topics, areaNames)
    )
}

/**
 * Set url if it's different from the current url.
 * When the user navigates back, we derive the state from the url and set it
 * so the url is already identical to the state - we don't need to push it again (otherwise we'd get an infinite loop)
 */
export function syncDataCatalogURL(stateAsUrl: string) {
    const currentUrl = window.location.href
    if (currentUrl !== stateAsUrl) {
        window.history.pushState({}, "", stateAsUrl)
    }
}

export function setToFacetFilters(
    facetSet: Set<string>,
    attribute: "tags" | "availableEntities"
) {
    return Array.from(facetSet).map((facet) => `${attribute}:${facet}`)
}

function getAllTagsInArea(area: TagGraphNode): string[] {
    const topics = area.children.reduce((tags, child) => {
        tags.push(child.name)
        if (child.children.length > 0) {
            tags.push(...getAllTagsInArea(child))
        }
        return tags
    }, [] as string[])
    return Array.from(new Set(topics))
}

export function getTopicsForRibbons(
    topics: Set<string>,
    tagGraph: TagGraphRoot
) {
    const topicTagGraph = flattenNonTopicNodes(tagGraph)
    if (topics.size === 0)
        return topicTagGraph.children.map((child) => child.name)
    if (topics.size === 1) {
        const area = topicTagGraph.children.find((child) =>
            topics.has(child.name)
        )
        if (area) {
            return getAllTagsInArea(area)
        }
    }
    return []
}

export function formatFacetFilters(
    values: Set<string>,
    attribute: "tags" | "availableEntities",
    requireAll: boolean
) {
    const facetFilters: (string | string[])[] = []
    if (requireAll) {
        // conjunction mode (A AND B): [attribute:"A", attribute:"B"]
        facetFilters.push(...setToFacetFilters(values, attribute))
    } else {
        // disjunction mode (A OR B): [[attribute:"A", attribute:"B"]]
        facetFilters.push(setToFacetFilters(values, attribute))
    }
    return facetFilters
}

export function getCountryData(selectedCountries: Set<string>): Region[] {
    const regionData: Region[] = []
    const countries = countriesByName()
    for (const selectedCountry of selectedCountries) {
        regionData.push(countries[selectedCountry])
    }
    return regionData
}

export function serializeSet(set?: Set<string>) {
    return set && set.size ? [...set].join("~") : undefined
}

export function deserializeSet(str?: string): Set<string> {
    return str ? new Set(str.split("~")) : new Set()
}

export function dataCatalogStateToAlgoliaQueries(
    state: DataCatalogState,
    topicNames: string[]
) {
    const countryFilters = getFiltersOfType(state, CatalogFilterType.COUNTRY)
    const countryFacetFilters = formatFacetFilters(
        countryFilters,
        "availableEntities",
        state.requireAllCountries
    )
    return topicNames.map((topic) => {
        const facetFilters = [[`tags:${topic}`], ...countryFacetFilters]
        return {
            indexName: CHARTS_INDEX,
            attributesToRetrieve: DATA_CATALOG_ATTRIBUTES,
            query: state.query,
            facetFilters: facetFilters,
            hitsPerPage: 4,
            facets: ["tags"],
            page: state.page < 0 ? 0 : state.page,
        }
    })
}

export function dataCatalogStateToAlgoliaQuery(state: DataCatalogState) {
    const countryFilters = getFiltersOfType(state, CatalogFilterType.COUNTRY)
    const topicFilters = getFiltersOfType(state, CatalogFilterType.TOPIC)

    // Format country and topic filters based on their respective requireAll settings
    const countryFacetFilters = formatFacetFilters(
        countryFilters,
        "availableEntities",
        state.requireAllCountries
    )
    const topicFacetFilters = formatFacetFilters(
        topicFilters,
        "tags",
        state.requireAllTags
    )

    // Combine all facet filters
    const facetFilters = [...countryFacetFilters, ...topicFacetFilters]

    return [
        {
            indexName: CHARTS_INDEX,
            attributesToRetrieve: DATA_CATALOG_ATTRIBUTES,
            query: state.query,
            facetFilters: facetFilters,
            highlightPostTag: "</mark>",
            highlightPreTag: "<mark>",
            facets: ["tags"],
            maxValuesPerFacet: 15,
            hitsPerPage: 60,
            page: state.page < 0 ? 0 : state.page,
        },
    ]
}

export function formatAlgoliaRibbonsResponse(
    response: MultipleQueriesResponse<IDataCatalogHit>,
    ribbonTopics: string[]
): DataCatalogRibbonResult[] {
    return response.results.map((res, i: number) => ({
        ...(res as SearchResponse<IDataCatalogHit>),
        title: ribbonTopics[i],
    }))
}

export function formatAlgoliaSearchResponse(
    response: MultipleQueriesResponse<IDataCatalogHit>
): DataCatalogSearchResult {
    const result = response.results[0] as SearchResponse<IDataCatalogHit>
    return result
}

/**
 * Async
 */
export async function queryRibbons(
    searchClient: SearchClient,
    state: DataCatalogState,
    tagGraph: TagGraphRoot
): Promise<DataCatalogRibbonResult[]> {
    const topicFilters = getFiltersOfType(state, CatalogFilterType.TOPIC)
    const topicsForRibbons = getTopicsForRibbons(topicFilters, tagGraph)
    const searchParams = dataCatalogStateToAlgoliaQueries(
        state,
        topicsForRibbons
    )
    return searchClient
        .search<IDataCatalogHit>(searchParams)
        .then((response) =>
            formatAlgoliaRibbonsResponse(response, topicsForRibbons)
        )
}

export async function querySearch(
    searchClient: SearchClient,
    state: DataCatalogState
): Promise<DataCatalogSearchResult> {
    const searchParams = dataCatalogStateToAlgoliaQuery(state)
    return searchClient
        .search<IDataCatalogHit>(searchParams)
        .then(formatAlgoliaSearchResponse)
}

// Function to query the pages index for data insights
export const queryDataInsights = async (
    searchClient: SearchClient,
    state: DataCatalogState
): Promise<DataCatalogResearchSearchResult> => {
    const index = searchClient.initIndex(getIndexName(SearchIndexName.Pages))
    const { query, page } = state
    const topicFilters = getFiltersOfType(state, CatalogFilterType.TOPIC)
    const countryFilters = getFiltersOfType(state, CatalogFilterType.COUNTRY)

    // Base facet filters
    const facetFilters: (string | string[])[] = [
        `type:${OwidGdocType.DataInsight}`,
    ]

    // Format topic filters based on requireAllTags setting
    const topicFacetFilters = formatFacetFilters(
        topicFilters,
        "tags",
        state.requireAllTags
    )

    // Combine all facet filters
    facetFilters.push(...topicFacetFilters)

    const queryWithCountryFilters =
        countryFilters.size > 0
            ? `${query} ${Array.from(countryFilters).join(" ")}`
            : query

    const results = await index.search<IPageHit>(queryWithCountryFilters, {
        page,
        hitsPerPage: state.componentCount[CatalogComponentId.DATA_INSIGHTS],
        highlightPreTag: "<mark>",
        highlightPostTag: "</mark>",
        facetFilters,
    })
    return results
}

// Function to query the pages index for research and writing content
export const queryResearch = async (
    searchClient: SearchClient,
    state: DataCatalogState
): Promise<DataCatalogResearchSearchResult> => {
    const index = searchClient.initIndex(getIndexName(SearchIndexName.Pages))
    const { query, page } = state
    const topicFilters = getFiltersOfType(state, CatalogFilterType.TOPIC)

    // Base facet filters with content types
    const facetFilters: (string | string[])[] = [
        [
            `type:${OwidGdocType.Article}`,
            `type:${OwidGdocType.LinearTopicPage}`,
            `type:${OwidGdocType.TopicPage}`,
        ],
    ]

    // Format topic filters based on requireAllTags setting
    const topicFacetFilters = formatFacetFilters(
        topicFilters,
        "tags",
        state.requireAllTags
    )

    // Combine all facet filters
    facetFilters.push(...topicFacetFilters)

    const results = await index.search<IPageHit>(query, {
        page,
        hitsPerPage:
            state.componentCount[CatalogComponentId.RESEARCH] ||
            DEFAULT_COMPONENTS.find((c) => c.id === CatalogComponentId.RESEARCH)
                ?.maxItems ||
            4,
        highlightPreTag: "<mark>",
        highlightPostTag: "</mark>",
        facetFilters,
    })
    return results
}

// Function to query research content for ribbon display
export const queryResearchRibbons = async (
    searchClient: SearchClient,
    state: DataCatalogState,
    tagGraph: TagGraphRoot
): Promise<DataCatalogResearchRibbonResult[]> => {
    const topicFilters = getFiltersOfType(state, CatalogFilterType.TOPIC)
    const topicsForRibbons = getTopicsForRibbons(topicFilters, tagGraph)

    // Build an array of search params for each topic
    const searchParams = topicsForRibbons.map((topic) => ({
        indexName: getIndexName(SearchIndexName.Pages),
        query: state.query,
        facetFilters: [[`type:${OwidGdocType.Article}`], [`tags:${topic}`]],
        page: state.page < 0 ? 0 : state.page,
        hitsPerPage:
            state.componentCount[CatalogComponentId.RESEARCH] ||
            DEFAULT_COMPONENTS.find((c) => c.id === CatalogComponentId.RESEARCH)
                ?.maxItems ||
            4,
        highlightPreTag: "<mark>",
        highlightPostTag: "</mark>",
    }))

    // Send a single multiqueries request
    const response = await searchClient.search<IPageHit>(searchParams)

    // Format the response
    const results = response.results.map((result, i) => ({
        ...(result as SearchResponse<IPageHit>),
        title: topicsForRibbons[i],
    }))

    // Filter out topics with no results
    return results.filter((result) => result.hits.length > 0)
}

export const analytics = new SiteAnalytics()

export const searchClient = algoliasearch(ALGOLIA_ID, ALGOLIA_SEARCH_KEY)

// The slugs we index to Algolia don't include the /grapher/ or /explorers/ directories
// Prepend them with this function when we need them
export const prependSubdirectoryToAlgoliaItemUrl = (item: BaseItem): string => {
    const indexName = parseIndexName(item.__autocomplete_indexName as string)
    const subdirectory = indexNameToSubdirectoryMap[indexName]
    switch (indexName) {
        case SearchIndexName.ExplorerViews:
            return `${subdirectory}/${item.explorerSlug}${item.viewQueryParams}`
        default:
            return `${subdirectory}/${item.slug}`
    }
}

export const getActiveItemCollection = (state: AutocompleteState<BaseItem>) => {
    return state.collections.find((collection) =>
        collection.items.some(
            (item) => item.__autocomplete_id === state.activeItemId
        )
    )
}
