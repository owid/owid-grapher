import {
    HitAttributeHighlightResult,
    HitAttributeSnippetResult,
    HitHighlightResult,
    SearchForFacetValuesResponse,
    SearchResponse,
} from "instantsearch.js"
import { getIndexName } from "../search/searchClient.js"
import { SearchIndexName } from "../search/searchTypes.js"
import { TagGraphRoot } from "@ourworldindata/types"
import { DataCatalogState, dataCatalogStateToUrl } from "./DataCatalogState.js"
import { countriesByName, Region } from "@ourworldindata/utils"
import { SearchClient } from "algoliasearch"

/**
 * Constants
 */
const CHARTS_INDEX = getIndexName(SearchIndexName.Charts)

const DATA_CATALOG_ATTRIBUTES = [
    "title",
    "slug",
    "availableEntities",
    "variantName",
]

/**
 * Types
 */
// This is a type that algolia doesn't export but is necessary to work with the algolia client
// Effectively the same as Awaited<ReturnType<SearchClient["search"]>>, but generic
type MultipleQueriesResponse<TObject> = {
    results: Array<SearchResponse<TObject> | SearchForFacetValuesResponse>
}

// This is the type for the hits that we get back from algolia when we search
// response.results[0].hits is an array of these
export type IDataCatalogHit = {
    title: string
    slug: string
    availableEntities: string[]
    objectID: string
    variantName: string | null
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

export type DataCatalogCache = {
    ribbons: Map<string, DataCatalogRibbonResult[]>
    search: Map<string, DataCatalogSearchResult>
}

/**
 * Utils
 */
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

// set url if it's different from the current url.
// when the user navigates back, we derive the state from the url and set it
// so the url is already identical to the state - we don't need to push it again (otherwise we'd get an infinite loop)
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

export function getTopicsForRibbons(
    topics: Set<string>,
    tagGraph: TagGraphRoot
) {
    if (topics.size === 0) return tagGraph.children.map((child) => child.name)
    if (topics.size === 1) {
        const area = tagGraph.children.find((child) => topics.has(child.name))
        if (area) return area.children.map((child) => child.name)
    }
    return []
}

export function formatCountryFacetFilters(
    countries: Set<string>,
    requireAllCountries: boolean
) {
    const facetFilters: (string | string[])[] = []
    if (requireAllCountries) {
        // conjunction mode (A AND B): [attribute:"A", attribute:"B"]
        facetFilters.push(...setToFacetFilters(countries, "availableEntities"))
    } else {
        // disjunction mode (A OR B): [[attribute:"A", attribute:"B"]]
        facetFilters.push(setToFacetFilters(countries, "availableEntities"))
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

export function serializeSet(set: Set<string>) {
    return set.size ? [...set].join("~") : undefined
}

export function deserializeSet(str?: string): Set<string> {
    return str ? new Set(str.split("~")) : new Set()
}

export function dataCatalogStateToAlgoliaQueries(
    state: DataCatalogState,
    topicNames: string[]
) {
    const countryFacetFilters = formatCountryFacetFilters(
        state.selectedCountryNames,
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
    const facetFilters = formatCountryFacetFilters(
        state.selectedCountryNames,
        state.requireAllCountries
    )
    facetFilters.push(...setToFacetFilters(state.topics, "tags"))

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
            hitsPerPage: 20,
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
    return {
        ...result,
        hits: result.hits.map((hit, i) => ({
            ...hit,
            // TODO: not necessary anymore
            __position: i + 1,
        })),
    }
}

/**
 * Async
 */
export async function queryRibbonsWithCache(
    searchClient: SearchClient,
    state: DataCatalogState,
    tagGraph: TagGraphRoot,
    cache: React.MutableRefObject<DataCatalogCache>
): Promise<void> {
    const topicsForRibbons = getTopicsForRibbons(state.topics, tagGraph)
    const searchParams = dataCatalogStateToAlgoliaQueries(
        state,
        topicsForRibbons
    )
    return searchClient
        .search<IDataCatalogHit>(searchParams)
        .then((response) =>
            formatAlgoliaRibbonsResponse(response, topicsForRibbons)
        )
        .then((formatted) => {
            cache.current.ribbons.set(dataCatalogStateToUrl(state), formatted)
        })
}

export async function querySearchWithCache(
    searchClient: SearchClient,
    state: DataCatalogState,
    cache: React.MutableRefObject<DataCatalogCache>
): Promise<void> {
    const searchParams = dataCatalogStateToAlgoliaQuery(state)
    return searchClient
        .search<IDataCatalogHit>(searchParams)
        .then(formatAlgoliaSearchResponse)
        .then((formatted) => {
            cache.current.search.set(dataCatalogStateToUrl(state), formatted)
        })
}
