import { HitAttributeHighlightResult, SearchResponse } from "instantsearch.js"
import {
    EntityName,
    GrapherQueryParams,
    TagGraphNode,
    TagGraphRoot,
} from "@ourworldindata/types"
import {
    Region,
    getRegionByNameOrVariantName,
    regions,
    escapeRegExp,
    removeTrailingParenthetical,
    lazy,
    Url,
    countriesByName,
    FuzzySearch,
} from "@ourworldindata/utils"
import { generateSelectedEntityNamesParam } from "@ourworldindata/grapher"
import { getIndexName } from "./searchClient.js"
import { SearchClient } from "algoliasearch"
import {
    MultipleQueriesResponse,
    IDataCatalogHit,
    DataCatalogRibbonResult,
    DataCatalogSearchResult,
    SearchIndexName,
    SearchState,
    Filter,
    FilterType,
    SearchAutocompleteContextType,
} from "./searchTypes.js"
import { faTag } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { match } from "ts-pattern"
import { createContext, useContext } from "react"

/**
 * The below code is used to search for entities we can highlight in charts and explorer results.
 *
 * There are two main functions here:
 * - `extractRegionNamesFromSearchQuery` looks at the search query (e.g. "covid cases us china asia") and extracts anything
 *   that looks like a country, region or variant name (e.g. "US"), case-insensitive.
 *   It doesn't have any knowledge of what entities are actually available.
 * - `pickEntitiesForChartHit` gets information about the entities available in a chart.
 *    It also receives the result of `extractRegionNamesFromSearchQuery`, i.e. a list of regions that are mentioned in the search query.
 *    This is useful because Algolia removes stop words like "the" and "and", which makes it difficult to match entities like
 *    "Trinidad and Tobago".
 *    - It then reduces this list to the entities that are actually available in the chart.
 *    - Afterwards, it uses the highlighted entities from Algolia to pick any other entities that are fully contained in the
 *      search query - this now adds any entities _not_ in the `regions` list, like "high-income countries" or "Salmon (farmed)".
 *
 * In practice, we use `pickEntitiesForChartHit` for explorers, since there we don't have any entity information available,
 * and can only act based on the fact that most explorers are country-based and have data for most countries and regions.
 * For charts, we use the more accurate `pickEntitiesForChartHit` function, since entity information is available.
 *
 * -- @marcelgerber, 2024-06-18
 */
const getRegionNameRegex = lazy(() => {
    const allCountryNamesAndVariants = lazy(() =>
        regions.flatMap((c) => [
            c.name,
            ...(("variantNames" in c && c.variantNames) || []),
        ])
    )

    // A RegExp that matches any country, region and variant name. Case-independent.
    return new RegExp(
        `\\b(${allCountryNamesAndVariants().map(escapeRegExp).join("|")})\\b`,
        "gi"
    )
})

export const extractRegionNamesFromSearchQuery = (query: string) => {
    const matches = query.matchAll(getRegionNameRegex())
    const regionNames = Array.from(matches, (match) => match[0])
    if (regionNames.length === 0) return null
    return regionNames.map(getRegionByNameOrVariantName) as Region[]
}

const removeHighlightTags = (text: string) =>
    text.replace(/<\/?(mark|strong)>/g, "")

export function pickEntitiesForChartHit(
    availableEntitiesHighlighted: HitAttributeHighlightResult[] | undefined,
    availableEntities: EntityName[] | undefined,
    searchQueryRegionsMatches: Region[] | undefined
): EntityName[] {
    if (!availableEntities) return []

    const pickedEntities = new Set(
        searchQueryRegionsMatches?.map((r) => r.name)
    )

    // Build intersection of searchQueryRegionsMatches and availableEntities, so we only select entities that are actually present in the chart
    if (pickedEntities.size > 0) {
        const availableEntitiesSet = new Set(availableEntities)
        for (const entity of pickedEntities) {
            if (!availableEntitiesSet.has(entity)) {
                pickedEntities.delete(entity)
            }
        }
    }

    if (availableEntitiesHighlighted) {
        for (const highlightEntry of availableEntitiesHighlighted) {
            if (highlightEntry.matchLevel === "none") continue

            const withoutHighlightTags = removeHighlightTags(
                highlightEntry.value
            )
            if (pickedEntities.has(withoutHighlightTags)) continue

            // Remove any trailing parentheses, e.g. "Africa (UN)" -> "Africa"
            const withoutTrailingParens =
                removeTrailingParenthetical(withoutHighlightTags)

            // The sequence of words that Algolia matched; could be something like ["arab", "united", "republic"]
            // which we want to check against the entity name
            const matchedSequenceLowerCase = highlightEntry.matchedWords
                .join(" ")
                .toLowerCase()

            // Pick entity if the matched sequence contains the full entity name
            if (
                matchedSequenceLowerCase.startsWith(
                    withoutTrailingParens
                        .replaceAll("-", " ") // makes "high-income countries" into "high income countries", enabling a match
                        .toLowerCase()
                )
            )
                pickedEntities.add(withoutHighlightTags)
        }
    }

    const sortedEntities = [...pickedEntities].sort()

    return sortedEntities ?? []
}

export const getEntityQueryStr = (
    entities: EntityName[] | null | undefined,
    existingQueryStr: string = ""
) => {
    if (!entities?.length) return existingQueryStr
    else {
        return Url.fromQueryStr(existingQueryStr).updateQueryParams({
            // If we have any entities pre-selected, we want to show the chart tab
            tab: "chart",
            country: generateSelectedEntityNamesParam(entities),
        } satisfies GrapherQueryParams).queryStr
    }
}

export const CHARTS_INDEX = getIndexName(
    SearchIndexName.ExplorerViewsMdimViewsAndCharts
)
export const DATA_CATALOG_ATTRIBUTES = [
    "title",
    "slug",
    "availableEntities",
    "originalAvailableEntities",
    "variantName",
    "type",
    "queryParams",
]

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
    if (topics.size === 0) return tagGraph.children.map((child) => child.name)
    if (topics.size === 1) {
        const area = tagGraph.children.find((child) => topics.has(child.name))
        if (area) return getAllTagsInArea(area)
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
    // Don't show income group-specific FMs if no countries are selected
    if (!countries.size) {
        facetFilters.push("isIncomeGroupSpecificFM:false")
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

export const getFilterIcon = (filter: Filter) => {
    return match(filter.type)
        .with(FilterType.COUNTRY, () => (
            <img
                className="flag"
                aria-hidden={true}
                height={12}
                width={16}
                src={`/images/flags/${countriesByName()[filter.name].code}.svg`}
            />
        ))
        .with(FilterType.TOPIC, () => (
            <span className="tag">
                <FontAwesomeIcon icon={faTag} />
            </span>
        ))
        .otherwise(() => null)
}

export function dataCatalogStateToAlgoliaQueries(
    state: SearchState,
    topicNames: string[]
) {
    const countryFacetFilters = formatCountryFacetFilters(
        getFilterNamesOfType(state.filters, FilterType.COUNTRY),
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

export function dataCatalogStateToAlgoliaQuery(state: SearchState) {
    const facetFilters = formatCountryFacetFilters(
        getFilterNamesOfType(state.filters, FilterType.COUNTRY),
        state.requireAllCountries
    )
    facetFilters.push(
        ...setToFacetFilters(
            getFilterNamesOfType(state.filters, FilterType.TOPIC),
            "tags"
        )
    )

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
    state: SearchState,
    tagGraph: TagGraphRoot
): Promise<DataCatalogRibbonResult[]> {
    const topicsForRibbons = getTopicsForRibbons(
        getFilterNamesOfType(state.filters, FilterType.TOPIC),
        tagGraph
    )
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
    state: SearchState
): Promise<DataCatalogSearchResult> {
    const searchParams = dataCatalogStateToAlgoliaQuery(state)
    return searchClient
        .search<IDataCatalogHit>(searchParams)
        .then(formatAlgoliaSearchResponse)
}

export function getAutocompleteSuggestions(
    query: string,
    allTopics: string[],
    filters: Filter[]
): Filter[] {
    const sortOptions = {
        threshold: 0.5,
        limit: 3,
    }
    const selectedCountryNames = getFilterNamesOfType(
        filters,
        FilterType.COUNTRY
    )
    const selectedTopics = getFilterNamesOfType(filters, FilterType.TOPIC)
    const allCountries = countriesByName()
    const allCountryNames = Object.values(allCountries).map(
        (country) => country.name
    )
    const lastWord = query.split(" ").at(-1) ?? ""

    const countryFilters = FuzzySearch.withKey(
        allCountryNames,
        (country) => country,
        sortOptions
    )
        .search(lastWord)
        .filter((country) => !selectedCountryNames.has(country))
        .map(createCountryFilter)

    const topicFilters =
        // Suggest topics only if none are currently active
        selectedTopics.size === 0
            ? FuzzySearch.withKey(allTopics, (topic) => topic, sortOptions)
                  .search(lastWord)
                  .slice(0, 3)
                  .map(createTopicFilter)
            : []

    return [
        ...(query ? [createQueryFilter(query)] : []),
        ...countryFilters,
        ...topicFilters,
    ]
}

export function createFilter(type: FilterType) {
    return (name: string): Filter => ({ type, name })
}

export const createCountryFilter = createFilter(FilterType.COUNTRY)
export const createTopicFilter = createFilter(FilterType.TOPIC)
export const createQueryFilter = createFilter(FilterType.QUERY)

export const SearchAutocompleteContext = createContext<
    SearchAutocompleteContextType | undefined
>(undefined)

export function useSearchAutocomplete() {
    const context = useContext(SearchAutocompleteContext)
    if (context === undefined) {
        throw new Error(
            "useSearchAutocomplete must be used within a SearchAutocompleteContextProvider"
        )
    }
    return context
}
