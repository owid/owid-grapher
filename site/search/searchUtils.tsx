import * as _ from "lodash-es"
import { HitAttributeHighlightResult } from "instantsearch.js"
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
    removeTrailingParenthetical,
    lazy,
    Url,
    countriesByName,
    FuzzySearch,
    FuzzySearchResult,
} from "@ourworldindata/utils"
import { partition } from "remeda"
import { generateSelectedEntityNamesParam } from "@ourworldindata/grapher"
import { getIndexName } from "./searchClient.js"
import {
    SearchIndexName,
    Filter,
    FilterType,
    ScoredSearchResult,
    SearchResultType,
    SearchTopicType,
} from "./searchTypes.js"
import { faTag } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { match, P } from "ts-pattern"
import { ForwardedRef } from "react"

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
        `\\b(${allCountryNamesAndVariants().map(_.escapeRegExp).join("|")})\\b`,
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
            <span className="icon">
                <FontAwesomeIcon icon={faTag} />
            </span>
        ))
        .otherwise(() => null)
}

export function searchWithWords(
    words: string[],
    allCountryNames: string[],
    allTopics: string[],
    selectedCountryNames: Set<string>,
    selectedTopics: Set<string>,
    sortOptions: { threshold: number; limit: number }
): {
    countryResults: ScoredSearchResult[]
    topicResults: ScoredSearchResult[]
    hasResults: boolean
} {
    const searchTerm = words.join(" ")

    const countryResults = FuzzySearch.withKey(
        allCountryNames,
        (country) => country,
        sortOptions
    )
        .searchResults(searchTerm)
        .filter(
            (result: FuzzySearchResult) =>
                !selectedCountryNames.has(result.target)
        )
        .map((result: FuzzySearchResult) => ({
            name: result.target,
            score: result.score,
        }))

    const topicResults: ScoredSearchResult[] =
        selectedTopics.size === 0
            ? FuzzySearch.withKey(allTopics, (topic) => topic, sortOptions)
                  .searchResults(searchTerm)
                  .map((result: FuzzySearchResult) => ({
                      name: result.target,
                      score: result.score,
                  }))
            : []

    return {
        countryResults,
        topicResults,
        hasResults: countryResults.length > 0 || topicResults.length > 0,
    }
}

export function findMatches(
    words: string[],
    allCountryNames: string[],
    allTopics: string[],
    selectedCountryNames: Set<string>,
    selectedTopics: Set<string>,
    sortOptions: { threshold: number; limit: number },
    wordIndex: number = 0
): {
    countryResults: ScoredSearchResult[]
    topicResults: ScoredSearchResult[]
    matchStartIndex: number
} {
    const wordsToSearch = words.slice(wordIndex)
    const results = searchWithWords(
        wordsToSearch,
        allCountryNames,
        allTopics,
        selectedCountryNames,
        selectedTopics,
        sortOptions
    )

    if (results.hasResults) {
        return {
            countryResults: results.countryResults,
            topicResults: results.topicResults,
            matchStartIndex: wordIndex,
        }
    }

    return wordIndex < words.length - 1
        ? findMatches(
              words,
              allCountryNames,
              allTopics,
              selectedCountryNames,
              selectedTopics,
              sortOptions,
              wordIndex + 1
          )
        : {
              countryResults: [],
              topicResults: [],
              matchStartIndex: words.length,
          }
}

/**
 * Generates autocomplete suggestions for a search query and identifies any unmatched portion of the query.
 *
 * This function takes a search query and finds possible country and topic suggestions by:
 * 1. Splitting the query into words
 * 2. Finding the earliest word index where country and/or topic matches can be found using fuzzy search
 * 3. Returning the found matches as Filter objects, sorted with exact matches first
 * 4. Also returning the unmatched portion of the query (words before the match point)
 *
 * The function uses fuzzy search to match partial query words against country names and topics,
 * filtering out any countries or topics that have already been selected as filters.
 * It progressively tries to match from increasing starting points in the query until it finds matches
 * or reaches the end of the query. This prioritizes matching whole phrases from the beginning, while still
 * allowing for matching just the latter parts of the query if necessary (e.g. "air pollution" would match "Air Pollution",
 * "Indoor Air Pollution" and "Outdoor Air Pollution" and prevent the "pollution" query from being run;
 * thus not returning "Lead Pollution" as a suggestion).
 *
 * Exact matches (score = 1) are prioritized in the returned suggestions array, followed by
 * the original query (as a query filter), and then partial matches sorted by score.
 *
 */
export function getAutocompleteSuggestionsWithUnmatchedQuery(
    query: string,
    allTopics: string[],
    filters: Filter[]
): {
    suggestions: Filter[]
    unmatchedQuery: string
} {
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

    const queryWords = query.trim().split(/\s+/)

    if (!queryWords.length || queryWords[0] === "") {
        return {
            suggestions: [],
            unmatchedQuery: "",
        }
    }

    const searchResults = findMatches(
        queryWords,
        allCountryNames,
        allTopics,
        selectedCountryNames,
        selectedTopics,
        sortOptions
    )

    const unmatchedQuery = queryWords
        .slice(0, searchResults.matchStartIndex)
        .join(" ")

    const countryMatches = searchResults.countryResults.map((result) => ({
        filter: createCountryFilter(result.name),
        score: result.score,
    }))

    const topicMatches = searchResults.topicResults.map((result) => ({
        filter: createTopicFilter(result.name),
        score: result.score,
    }))

    const allMatches = [...countryMatches, ...topicMatches]

    const [exactMatches, partialMatches] = partition(
        allMatches,
        (item) => item.score === 1
    )

    const sortedPartialMatches = partialMatches.sort(
        (a, b) => b.score - a.score
    )

    const combinedFilters = [
        ...exactMatches.map((item) => item.filter),
        ...(query ? [createQueryFilter(query)] : []),
        ...sortedPartialMatches.map((item) => item.filter),
    ]

    return {
        suggestions: combinedFilters,
        unmatchedQuery,
    }
}

export function createFilter(type: FilterType) {
    return (name: string): Filter => ({ type, name })
}

export const createCountryFilter = createFilter(FilterType.COUNTRY)
export const createTopicFilter = createFilter(FilterType.TOPIC)
export const createQueryFilter = createFilter(FilterType.QUERY)

/**
 * Returns a click handler that focuses an input element when clicking on the
 * target element or its children. If checkTargetEquality is true, only focus
 * the input if the click happened on the element where the handler is
 * attached (effectively not registering clicks on children).
 */
export const createFocusInputOnClickHandler = (
    inputRef: ForwardedRef<HTMLInputElement>,

    checkTargetEquality: boolean = false
) => {
    const handleClick = (e: React.MouseEvent) => {
        if (
            (!checkTargetEquality || e.target === e.currentTarget) &&
            isCurrentRef(inputRef)
        ) {
            inputRef.current.focus()
        }
    }

    return handleClick
}

/*
 * Type guard to check if a ref is a RefObject with a non-null current property
 */
export function isCurrentRef(
    inputRef: ForwardedRef<HTMLInputElement>
): inputRef is React.RefObject<HTMLInputElement> {
    return (
        inputRef !== null &&
        typeof inputRef === "object" &&
        "current" in inputRef &&
        inputRef.current !== null
    )
}

export const getSearchAutocompleteId = () => "search-autocomplete-listbox"

export const getSearchAutocompleteItemId = (index: number) =>
    index >= 0 ? `search-autocomplete-item-${index}` : undefined

export const getFilterAriaLabel = (
    filter: Filter,
    action: "add" | "remove"
) => {
    const actionName = action === "add" ? "Add" : "Remove"
    return match(filter.type)
        .with(FilterType.QUERY, () => `Search for ${filter.name}`)
        .with(
            P.union(FilterType.COUNTRY, FilterType.TOPIC),
            () => `${actionName} ${filter.name} ${filter.type} filter`
        )
        .exhaustive()
}

export const isValidResultType = (
    value: string | undefined
): value is SearchResultType => {
    return Object.values(SearchResultType).includes(value as SearchResultType)
}

export function getSelectedTopicType(
    filters: Filter[],
    areaNames: string[]
): SearchTopicType | null {
    const firstTopicFilter = filters.find(
        (filter) => filter.type === FilterType.TOPIC
    )
    if (!firstTopicFilter) return null

    return areaNames.includes(firstTopicFilter.name)
        ? SearchTopicType.Area
        : SearchTopicType.Topic
}
