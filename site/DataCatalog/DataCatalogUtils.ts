import { SearchResponse } from "instantsearch.js"
import { getIndexName } from "../search/searchClient.js"
import { IChartHit, SearchIndexName } from "../search/searchTypes.js"
import { TagGraphRoot } from "@ourworldindata/types"
import { DataCatalogState, dataCatalogStateToUrl } from "./DataCatalogState.js"
import { countriesByName, Region } from "@ourworldindata/utils"
import { SearchClient } from "algoliasearch"

/**
 * Constants
 */
const CHARTS_INDEX = getIndexName(SearchIndexName.Charts)

/**
 * Types
 */
export type DataCatalogHit = {
    title: string
    slug: string
    availableEntities: string[]
}

export type DataCatalogCache = {
    ribbons: Map<string, DataCatalogRibbonResult[]>
    search: Map<string, DataCatalogSearchResult>
}

export type DataCatalogSearchResult = SearchResponse<IChartHit>

export type DataCatalogRibbonResult = SearchResponse<IChartHit> & {
    title: string
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
    setTimeout(() => {
        window.scrollTo({ behavior: "smooth", top: 0 })
    }, 100)
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
            query: state.query,
            facetFilters: facetFilters,
            attributesToRetrieve: [
                "title",
                "slug",
                "availableEntities",
                "variantName",
            ],
            hitsPerPage: 4,
            page: state.page,
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
            query: state.query,
            facetFilters: facetFilters,
            attributesToRetrieve: [
                "title",
                "slug",
                "availableEntities",
                "variantName",
            ],
            highlightPostTag: "</mark>",
            highlightPreTag: "<mark>",
            facets: ["tags"],
            hitsPerPage: 20,
            page: state.page,
        },
    ]
}

export function formatAlgoliaRibbonsResponse(
    response: any,
    ribbonTopics: string[]
): DataCatalogRibbonResult[] {
    return response.results.map(
        (res: SearchResponse<DataCatalogHit>, i: number) => ({
            ...res,
            title: ribbonTopics[i],
        })
    )
}

export function formatAlgoliaSearchResponse(
    response: any
): DataCatalogSearchResult {
    return {
        ...response.results[0],
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
        .search<DataCatalogRibbonResult>(searchParams)
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
        .search<DataCatalogHit>(searchParams)
        .then(formatAlgoliaSearchResponse)
        .then((formatted) => {
            cache.current.search.set(dataCatalogStateToUrl(state), formatted)
        })
}
