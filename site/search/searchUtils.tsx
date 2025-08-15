import * as _ from "lodash-es"
import { HitAttributeHighlightResult } from "instantsearch.js"
import {
    EntityName,
    GRAPHER_CHART_TYPES,
    GRAPHER_TAB_NAMES,
    GRAPHER_TAB_QUERY_PARAMS,
    GrapherChartType,
    GrapherQueryParams,
    GrapherTabName,
    GrapherTabQueryParam,
    GrapherValuesJson,
    GrapherValuesJsonDataPoint,
    OwidGdocType,
    TagGraphRoot,
    TimeBounds,
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
    getAllChildrenOfArea,
    timeBoundToTimeBoundString,
    queryParamsToStr,
} from "@ourworldindata/utils"
import { partition, uniqueBy } from "remeda"
import {
    generateSelectedEntityNamesParam,
    GrapherState,
    isValidTabQueryParam,
    mapGrapherTabNameToQueryParam,
} from "@ourworldindata/grapher"
import { getIndexName } from "./searchClient.js"
import {
    SearchIndexName,
    Filter,
    FilterType,
    ScoredSearchResult,
    SearchResultType,
    SearchTopicType,
    SearchFacetFilters,
    ChartRecordType,
    SearchChartHit,
    IChartHit,
    SearchUrlParam,
    PageType,
    WordpressPageType,
    SynonymMap,
} from "./searchTypes.js"
import {
    faBook,
    faBookmark,
    faFileLines,
    faGlobe,
    faLightbulb,
    faTag,
    IconDefinition,
} from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { match, P } from "ts-pattern"
import { ForwardedRef } from "react"
import {
    BAKED_BASE_URL,
    BAKED_GRAPHER_URL,
    EXPLORER_DYNAMIC_THUMBNAIL_URL,
    GRAPHER_DYNAMIC_THUMBNAIL_URL,
} from "../../settings/clientSettings.js"
import { EXPLORERS_ROUTE_FOLDER } from "@ourworldindata/explorer"
import { SearchChartHitDataDisplayProps } from "./SearchChartHitDataDisplay.js"
import { CoreColumn } from "@ourworldindata/core-table"

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
    hit: IChartHit | SearchChartHit,
    searchQueryRegionsMatches: Region[] | undefined
): EntityName[] {
    const availableEntities =
        hit.originalAvailableEntities ?? hit.availableEntities
    if (!availableEntities) return []

    const availableEntitiesHighlighted = (hit._highlightResult
        ?.originalAvailableEntities ||
        hit._highlightResult?.availableEntities) as
        | HitAttributeHighlightResult[]
        | undefined

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

    // Add entities to the list of picked entities if they're typed in the search bar
    // even if a user hasn't selected them from the autocomplete dropdown
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

const generateGrapherTabQueryParam = ({
    tab,
    hasEntities,
}: {
    tab?: GrapherTabName | GrapherTabQueryParam
    hasEntities: boolean
}) => {
    if (tab) {
        return isValidTabQueryParam(tab)
            ? tab
            : mapGrapherTabNameToQueryParam(tab)
    }

    // If we have any entities pre-selected, we want to show the chart tab
    if (hasEntities) return GRAPHER_TAB_QUERY_PARAMS.chart

    return undefined
}

const generateGrapherTimeQueryParam = ({
    timeBounds,
    timeMode = "year",
}: {
    timeBounds: TimeBounds
    timeMode?: "year" | "day"
}) => {
    return timeBounds
        .map((time) => timeBoundToTimeBoundString(time, timeMode === "day"))
        .join("..")
}

export const getEntityQueryStr = (
    entities: EntityName[] | null | undefined
): string => {
    const hasEntities = !!entities?.length

    const countryParam = hasEntities
        ? generateSelectedEntityNamesParam(entities)
        : undefined

    const queryParams = { country: countryParam } satisfies GrapherQueryParams

    const url = Url.fromQueryParams(queryParams)

    return url.queryStr
}

export const toGrapherQueryParams = ({
    entities = [],
    tab,
    timeBounds,
    timeMode = "year",
}: {
    entities?: EntityName[]
    tab?: GrapherTabName
    timeBounds?: TimeBounds
    timeMode?: "year" | "day"
}): GrapherQueryParams => {
    const hasEntities = entities.length > 0
    return {
        tab: generateGrapherTabQueryParam({ tab, hasEntities }),
        country: hasEntities
            ? generateSelectedEntityNamesParam(entities)
            : undefined,
        time: timeBounds
            ? generateGrapherTimeQueryParam({ timeBounds, timeMode })
            : undefined,
    }
}

const generateQueryStrForChartHit = ({
    hit,
    grapherParams,
}: {
    hit: SearchChartHit
    grapherParams?: GrapherQueryParams
}): string => {
    const isExplorerView = hit.type === ChartRecordType.ExplorerView
    const isMultiDimView = hit.type === ChartRecordType.MultiDimView

    const viewQueryStr =
        isExplorerView || isMultiDimView ? hit.queryParams : undefined
    const grapherQueryStr = grapherParams
        ? queryParamsToStr(grapherParams)
        : undefined

    // Remove leading '?' from query strings
    const queryStrList = [viewQueryStr, grapherQueryStr]
        .map((queryStr) => queryStr?.replace(/^\?/, ""))
        .filter((queryStr) => queryStr)

    const queryStr = queryStrList.length > 0 ? "?" + queryStrList.join("&") : ""

    return queryStr
}

export const constructChartUrl = ({
    hit,
    grapherParams,
}: {
    hit: SearchChartHit
    grapherParams?: GrapherQueryParams
}): string => {
    const queryStr = generateQueryStrForChartHit({ hit, grapherParams })

    const isExplorerView = hit.type === ChartRecordType.ExplorerView
    const basePath = isExplorerView
        ? `${BAKED_BASE_URL}/${EXPLORERS_ROUTE_FOLDER}`
        : BAKED_GRAPHER_URL

    return `${basePath}/${hit.slug}${queryStr}`
}

export const constructChartInfoUrl = ({
    hit,
    grapherParams,
}: {
    hit: SearchChartHit
    grapherParams?: GrapherQueryParams
}): string | undefined => {
    const queryStr = generateQueryStrForChartHit({ hit, grapherParams })

    const isExplorerView = hit.type === ChartRecordType.ExplorerView
    const basePath = isExplorerView
        ? EXPLORER_DYNAMIC_THUMBNAIL_URL
        : GRAPHER_DYNAMIC_THUMBNAIL_URL

    return `${basePath}/${hit.slug}.values.json${queryStr}`
}

export const constructThumbnailUrl = ({
    hit,
    grapherParams,
}: {
    hit: SearchChartHit
    grapherParams?: GrapherQueryParams
}): string => {
    const isExplorerView = hit.type === ChartRecordType.ExplorerView

    const queryStr = generateQueryStrForChartHit({ hit, grapherParams })
    const thumbnailQueryStr = "imType=thumbnail"
    const fullQueryStr = queryStr
        ? `${queryStr}&${thumbnailQueryStr}`
        : `?${thumbnailQueryStr}`

    const basePath = isExplorerView
        ? EXPLORER_DYNAMIC_THUMBNAIL_URL
        : GRAPHER_DYNAMIC_THUMBNAIL_URL

    return `${basePath}/${hit.slug}.png${fullQueryStr}`
}

export const constructConfigUrl = ({
    hit,
}: {
    hit: SearchChartHit
}): string | undefined => {
    const isExplorerView = hit.type === ChartRecordType.ExplorerView
    if (isExplorerView) return undefined // Not yet supported

    const queryStr = generateQueryStrForChartHit({ hit })

    return `${GRAPHER_DYNAMIC_THUMBNAIL_URL}/${hit.slug}.config.json${queryStr}`
}

export const constructDownloadUrl = ({
    hit,
}: {
    hit: SearchChartHit
}): string => {
    const viewQueryStr = generateQueryStrForChartHit({ hit })
    const grapherParams = new URLSearchParams({
        overlay: "download-data",
    })
    const queryStr = viewQueryStr
        ? `${viewQueryStr}&${grapherParams}`
        : `?${grapherParams}`

    const isExplorerView = hit.type === ChartRecordType.ExplorerView
    const basePath = isExplorerView
        ? `${BAKED_BASE_URL}/${EXPLORERS_ROUTE_FOLDER}`
        : BAKED_GRAPHER_URL

    return `${basePath}/${hit.slug}${queryStr}`
}

// Generates time bounds to force line charts to display properly in previews.
// When start and end times are the same (single time point), line charts
// automatically switch to discrete bar charts. To prevent that, we set the start
// time to -Infinity, which refers to the earliest available data.
export function getTimeBoundsForChartUrl(
    chartInfo?: GrapherValuesJson | null
): { timeBounds: TimeBounds; timeMode: "year" | "day" } | undefined {
    if (!chartInfo) return undefined

    const { startTime, endTime } = chartInfo

    // When a chart has different start and end times, we don't need to adjust
    // the time parameter because the chart will naturally display as a line chart.
    // Note: `chartInfo` is fetched for the _default_ view. If startTime equals
    // endTime here, it doesn't necessarily mean that the line chart is actually
    // single-time, since we're looking at the default tab rather than the specific
    // line chart tab. However, false positives are generally harmless because most
    // charts don't customize their start time.
    if (startTime && startTime !== endTime) return undefined

    const columnSlug = chartInfo.endTimeValues?.y[0].columnSlug ?? ""
    const columnInfo = chartInfo.columns?.[columnSlug]

    return {
        timeBounds: [-Infinity, endTime ?? Infinity],
        timeMode: columnInfo?.yearIsDay ? "day" : "year",
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
    "availableTabs",
    "source",
    "subtitle",
]

export function setToFacetFilters(
    facetSet: Set<string>,
    attribute: "tags" | "availableEntities"
) {
    return Array.from(facetSet).map((facet) => `${attribute}:${facet}`)
}

export function getSelectableTopics(
    tagGraph: TagGraphRoot,
    selectedTopic: string | undefined
): Set<string> {
    if (!selectedTopic)
        return new Set(tagGraph.children.map((child) => child.name))

    const area = tagGraph.children.find((child) => child.name === selectedTopic)
    if (area)
        return new Set(getAllChildrenOfArea(area).map((node) => node.name))

    return new Set()
}

export function formatCountryFacetFilters(
    countries: Set<string>,
    requireAllCountries: boolean
) {
    const facetFilters: SearchFacetFilters = []
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

export const formatTopicFacetFilters = (
    topics: Set<string>
): SearchFacetFilters => {
    // disjunction mode (A OR B): [[attribute:"A", attribute:"B"]]
    return [setToFacetFilters(topics, "tags")]
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
    sortOptions: { threshold: number; limit: number },
    synonymMap: SynonymMap
): {
    countryResults: ScoredSearchResult[]
    topicResults: ScoredSearchResult[]
    hasResults: boolean
} {
    const searchTerm = words.join(" ")

    const searchCountryTopics = (term: string) => {
        const countryResults = FuzzySearch.withKey(
            allCountryNames,
            (country) => country,
            sortOptions
        )
            .searchResults(term)
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
                      .searchResults(term)
                      .map((result: FuzzySearchResult) => ({
                          name: result.target,
                          score: result.score,
                      }))
                : []

        return { countryResults, topicResults }
    }

    // 1. Perform original search
    const originalResults = searchCountryTopics(searchTerm)
    let allCountryResults = [...originalResults.countryResults]
    let allTopicResults = [...originalResults.topicResults]

    // 2. Search with synonyms
    const synonyms = synonymMap.get(searchTerm.toLowerCase())

    if (synonyms && synonyms.length > 0) {
        // Search with each synonym and combine results
        for (const synonym of synonyms) {
            const synonymResults = searchCountryTopics(synonym)
            allCountryResults.push(...synonymResults.countryResults)
            allTopicResults.push(...synonymResults.topicResults)
        }

        // Deduplicate results by name, keeping the highest score, and enforce
        // the limit given that we are running the search twice and combining
        // result sets, effectively doubling the number of results.
        const deduplicateResults = (results: ScoredSearchResult[]) =>
            uniqueBy(
                results.sort((a, b) => b.score - a.score),
                (result) => result.name
            ).slice(0, sortOptions.limit)

        allCountryResults = deduplicateResults(allCountryResults)
        allTopicResults = deduplicateResults(allTopicResults)
    }

    return {
        countryResults: allCountryResults,
        topicResults: allTopicResults,
        hasResults: allCountryResults.length > 0 || allTopicResults.length > 0,
    }
}

export function findMatches(
    words: string[],
    allCountryNames: string[],
    allTopics: string[],
    selectedCountryNames: Set<string>,
    selectedTopics: Set<string>,
    sortOptions: { threshold: number; limit: number },
    synonymMap: SynonymMap,
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
        sortOptions,
        synonymMap
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
              synonymMap,
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
 * This function uses fuzzy search to match partial query words against country names and topics,
 * filtering out any countries or topics that have already been selected as filters.
 * It progressively tries to match from increasing starting points in the query until it finds matches
 * or reaches the end of the query. This prioritizes matching whole phrases from the beginning, while still
 * allowing for matching just the latter parts of the query if necessary (e.g. "air pollution" would match "Air Pollution",
 * "Indoor Air Pollution" and "Outdoor Air Pollution" and prevent the "pollution" query from being run;
 * thus not returning "Lead Pollution" as a suggestion).
 *
 * **Search Process:**
 * 1. Splitting the query into words
 * 2. Finding the earliest word index where country and/or topic matches can be found using fuzzy search
 * 3. Returning the found matches as Filter objects, sorted with exact matches first
 * 4. Also returning the unmatched portion of the query (words before the match point)
 *
 * The search utilizes the same synonym definitions as Algolia to ensure consistent experiences
 * between Algolia-powered search (homepage autocomplete, nav bar autocomplete, search results) and local fuzzy search (filter autocomplete).
 * This includes bidirectional synonyms from synonym groups (e.g., "ai" ↔ "artificial intelligence")
 * and unidirectional country alternatives (e.g., "us" → "united states"). Results from both original
 * and synonym searches are combined, with duplicates removed while preserving the highest scores.
 *
 * **Result Prioritization:**
 * Exact matches (score = 1) are prioritized in the returned suggestions array, followed by
 * the original query (as a query filter), and then partial matches sorted by score descending.
 *
 * **Examples:**
 * - Query "artificial intelligence" → also searches for synonyms like "ai", "machine learning"
 * - Query "co2 emissions" → also searches for "carbon dioxide", "c02"
 * - Query "us" → "us" gets expanded to "united states" for better country matching
 *
 * @returns Object containing suggestion filters and any unmatched query portion
 */
export function getAutocompleteSuggestionsWithUnmatchedQuery(
    query: string,
    allTopics: string[],
    filters: Filter[], // currently active filters to exclude from suggestions
    synonymMap: SynonymMap,
    limitPerFilter: number = 3
): {
    suggestions: Filter[]
    unmatchedQuery: string
} {
    const sortOptions = {
        threshold: 0.5,
        limit: limitPerFilter,
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
        sortOptions,
        synonymMap
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

export const getSelectedTopic = (filters: Filter[]): string | undefined => {
    const selectedTopics = getFilterNamesOfType(filters, FilterType.TOPIC)
    return selectedTopics.size > 0 ? [...selectedTopics][0] : undefined
}

export function getSelectedTopicType(
    filters: Filter[],
    areaNames: string[]
): SearchTopicType | null {
    const selectedTopic = getSelectedTopic(filters)
    if (!selectedTopic) return null

    return areaNames.includes(selectedTopic)
        ? SearchTopicType.Area
        : SearchTopicType.Topic
}

/**
 * Checks if the search is in browsing mode, which is defined as having no query
 * and no filters applied.
 */
export const isBrowsing = (filters: Filter[], query: string) => {
    return query.trim() === "" && filters.length === 0
}

/**
 * Computes the effective result type that should be displayed/used in the UI.
 * This respects constraints (e.g., "all" is not allowed when browsing) while
 * preserving the user's desired result type in the state.
 */
export const getEffectiveResultType = (
    filters: Filter[],
    query: string,
    desiredResultType: SearchResultType
): SearchResultType => {
    return isBrowsing(filters, query) &&
        desiredResultType === SearchResultType.ALL
        ? SearchResultType.DATA
        : desiredResultType
}

export async function fetchJson<TResult>(url: string): Promise<TResult> {
    const response = await fetch(url)
    if (!response.ok) {
        throw new Error(`Failed to fetch ${url}: ${response.statusText}`)
    }
    return response.json()
}

export function getSortedGrapherTabsForChartHit(
    grapherState: GrapherState,
    maxTabs = 5
): GrapherTabName[] {
    const { Table, LineChart, Marimekko, WorldMap } = GRAPHER_TAB_NAMES

    // Original chart config before search customizations
    // (entity selection, tab switching, etc.)
    const originalGrapherState = grapherState.authorsVersion

    const {
        availableTabs,
        validChartTypes: availableChartTypes,
        validChartTypeSet: availableChartTypeSet,
    } = originalGrapherState

    const sortedTabs: GrapherTabName[] = []

    // First position
    if (availableChartTypeSet.has(LineChart)) {
        // If a line chart is available, it's always the first tab
        sortedTabs.push(LineChart)
    } else if (availableChartTypes.length > 0) {
        // Otherwise, pick the first valid chart type
        sortedTabs.push(availableChartTypes[0])
    } else if (availableTabs.includes(WorldMap)) {
        // Or a map
        sortedTabs.push(WorldMap)
    } else if (availableTabs.includes(Table)) {
        // Or a table
        sortedTabs.push(Table)
    }

    // Second position is always the table
    // (unless the table is already in the first position)
    if (sortedTabs[0] !== Table) sortedTabs.push(Table)

    // In the third position, prioritize the Marimekko chart
    if (sortedTabs[0] === LineChart && availableChartTypeSet.has(Marimekko)) {
        sortedTabs.push(Marimekko)
    }

    // Fill up the remaining positions
    sortedTabs.push(...availableTabs.filter((tab) => !sortedTabs.includes(tab)))

    return sortedTabs.slice(0, maxTabs)
}

export function buildChartHitDataDisplayProps({
    chartInfo,
    chartType,
    entity,
    isEntityPickedByUser,
}: {
    chartInfo?: GrapherValuesJson | null
    chartType?: GrapherChartType
    entity: EntityName
    isEntityPickedByUser?: boolean
}): SearchChartHitDataDisplayProps | undefined {
    if (!chartInfo) return undefined

    // Showing a time range only makes sense for slope charts and connected scatter plots
    const showTimeRange =
        chartType === GRAPHER_CHART_TYPES.SlopeChart ||
        chartType === GRAPHER_CHART_TYPES.ScatterPlot

    const endDatapoint = findDatapoint(chartInfo, "end")
    const startDatapoint = showTimeRange
        ? findDatapoint(chartInfo, "start")
        : undefined
    const columnInfo = endDatapoint?.columnSlug
        ? chartInfo?.columns?.[endDatapoint?.columnSlug]
        : undefined

    if (!endDatapoint?.formattedValueShort || !endDatapoint?.formattedTime)
        return undefined

    // For scatter plots, displaying a single data value is ambiguous since
    // they have two dimensions. But we do show a data value if the x axis
    // is GDP since then it's sufficiently clear
    const xSlug = chartInfo?.endTimeValues?.x?.columnSlug
    const xColumnInfo = chartInfo?.columns?.[xSlug ?? ""]
    const hasDataDisplay =
        chartType !== GRAPHER_CHART_TYPES.ScatterPlot ||
        /GDP/.test(xColumnInfo?.name ?? "")

    if (!hasDataDisplay) return undefined

    const endValue = endDatapoint.valueLabel ?? endDatapoint.formattedValueShort
    const startValue =
        startDatapoint?.valueLabel ?? startDatapoint?.formattedValueShort
    const unit = columnInfo ? getColumnUnitForDisplay(columnInfo) : undefined
    const time = startDatapoint?.formattedTime
        ? `${startDatapoint?.formattedTime}–${endDatapoint.formattedTime}`
        : endDatapoint.formattedTime
    const trend =
        startDatapoint?.value !== undefined && endDatapoint?.value !== undefined
            ? endDatapoint.value > startDatapoint.value
                ? "up"
                : endDatapoint.value < startDatapoint.value
                  ? "down"
                  : "right"
            : undefined
    const showLocationIcon = isEntityPickedByUser

    return {
        entityName: entity,
        endValue,
        startValue,
        time,
        unit,
        trend,
        showLocationIcon,
    }
}

function findDatapoint(
    chartInfo: GrapherValuesJson | undefined,
    time: "end" | "start" = "end"
): GrapherValuesJsonDataPoint | undefined {
    if (!chartInfo) return undefined

    const yDims = match(time)
        .with("end", () => chartInfo.endTimeValues?.y)
        .with("start", () => chartInfo.startTimeValues?.y)
        .exhaustive()
    if (!yDims) return undefined

    // Make sure we're not showing a projected data point
    const historicalDims = yDims.filter(
        (dim) => !chartInfo.columns?.[dim.columnSlug]?.isProjection
    )

    // Don't show a data value for charts with multiple y-indicators
    if (historicalDims.length > 1) return undefined

    return historicalDims[0]
}

export function getColumnNameForDisplay(column: CoreColumn): string {
    return column.titlePublicOrDisplayName.title ?? column.nonEmptyDisplayName
}

export function getColumnUnitForDisplay(
    column: CoreColumn | { unit?: string; shortUnit?: string },
    { allowTrivial = false }: { allowTrivial?: boolean } = {}
): string | undefined {
    if (!column.unit) return undefined

    // The unit is considered trivial if it is the same as the short unit
    const isTrivial = column.unit === column.shortUnit
    const unit = allowTrivial || !isTrivial ? column.unit : undefined

    // Remove parentheses from the beginning and end of the unit
    const strippedUnit = unit?.replace(/(^\(|\)$)/g, "")

    return strippedUnit
}

export enum GridSlot {
    SingleSlot = "single-slot",
    DoubleSlot = "double-slot",
    TripleSlot = "triple-slot",
    QuadSlot = "quad-slot",
    SmallSlotLeft = "small-slot-left",
    SmallSlotRight = "small-slot-right",
}

export function placeGrapherTabsInGridLayout(
    tabs: GrapherTabName[],
    {
        hasDataDisplay,
        numDataTableRows,
        numDataTableRowsPerColumn,
    }: {
        hasDataDisplay: boolean
        numDataTableRows?: number
        numDataTableRowsPerColumn?: number
    }
): { tab: GrapherTabName; slot: GridSlot }[] {
    // If there is a data display, then three equally-sized slots are available,
    // plus two smaller slots below the data display. If there is no data display,
    // then four equally-sized slots are available.

    if (hasDataDisplay) {
        const placedMainTabs = placeTabsInUniformGrid({
            tabs,
            numAvailableGridSlots: 3,
            numDataTableRows,
            numDataTableRowsPerColumn,
        })

        const remainingTabs = tabs.slice(placedMainTabs.length)
        const placedRemainingTabs = remainingTabs
            .slice(0, 2)
            .map((tab, tabIndex) => ({
                tab,
                slot:
                    tabIndex === 0
                        ? GridSlot.SmallSlotLeft
                        : GridSlot.SmallSlotRight,
            }))
        return [...placedMainTabs, ...placedRemainingTabs]
    } else {
        return placeTabsInUniformGrid({
            tabs,
            numAvailableGridSlots: 4,
            numDataTableRows,
            numDataTableRowsPerColumn,
        })
    }
}

/**
 * Place Grapher tabs in a uniform grid layout.
 *
 * Chart tabs always occupy a single slots. The table tab might occupy more
 * than one slot if there is space and enough data to fill it.
 */
function placeTabsInUniformGrid({
    tabs,
    numAvailableGridSlots,
    numDataTableRows,
    numDataTableRowsPerColumn = 4,
}: {
    tabs: GrapherTabName[]
    numAvailableGridSlots: number
    numDataTableRows?: number // no restriction if undefined
    numDataTableRowsPerColumn?: number
}) {
    const maxNumTabs = numAvailableGridSlots

    // If none of the tabs display a table, then all tabs trivially take up one slot each
    if (!tabs.some((tab) => tab === GRAPHER_TAB_NAMES.Table)) {
        return tabs
            .slice(0, maxNumTabs)
            .map((tab) => ({ tab, slot: GridSlot.SingleSlot }))
    }

    const numTabs = Math.min(tabs.length, maxNumTabs)
    const numCharts = numTabs - 1 // without the table tab

    const numAvailableSlotsForTable = numAvailableGridSlots - numCharts // >= 1

    if (numAvailableSlotsForTable <= 1) {
        return tabs
            .slice(0, maxNumTabs)
            .map((tab) => ({ tab, slot: GridSlot.SingleSlot }))
    }

    const numNeededSlotsForTable =
        numDataTableRows === undefined
            ? Infinity // no restriction
            : Math.ceil(numDataTableRows / numDataTableRowsPerColumn)

    const numSlotsForTable = Math.min(
        numAvailableSlotsForTable,
        numNeededSlotsForTable
    )
    const tableSlot = getGridSlotForCount(numSlotsForTable)

    return tabs.map((tab) => ({
        tab,
        slot: tab === GRAPHER_TAB_NAMES.Table ? tableSlot : GridSlot.SingleSlot,
    }))
}

function getGridSlotForCount(slotCount: number): GridSlot {
    if (slotCount <= 1) return GridSlot.SingleSlot
    else if (slotCount === 2) return GridSlot.DoubleSlot
    else if (slotCount === 3) return GridSlot.TripleSlot
    else return GridSlot.QuadSlot
}

export function getRowCountForGridSlot(
    slot: GridSlot,
    numRowsPerColumn: number
): number {
    const numColumns = match(slot)
        .with(GridSlot.SingleSlot, () => 1)
        .with(GridSlot.DoubleSlot, () => 2)
        .with(GridSlot.TripleSlot, () => 3)
        .with(GridSlot.QuadSlot, () => 4)
        .with(GridSlot.SmallSlotLeft, () => 0)
        .with(GridSlot.SmallSlotRight, () => 0)
        .exhaustive()
    return numColumns * numRowsPerColumn
}

export const getUrlParamNameForFilter = (filter: Filter) =>
    match(filter.type)
        .with(FilterType.COUNTRY, () => SearchUrlParam.COUNTRY)
        .with(FilterType.TOPIC, () => SearchUrlParam.TOPIC)
        .with(FilterType.QUERY, () => SearchUrlParam.QUERY)
        .exhaustive()

/**
 * Builds a fully qualified search URL for the provided autocomplete filter.
 *
 * If the filter type is `COUNTRY` or `TOPIC`, the URL also includes a
 * `resultType=ALL` parameter to broaden the search results. Regular query terms
 * (the only other filter type) do not include this parameter and will default
 * to "resultType=data" (this parameter is assumed but not shown in the URL)
 *
 * When selecting "Kenya" as a country filter, the search query string would be:
 * "?country=Kenya&resultType=all"
 *
 * Non-country/topic filters do not include any extra parameters. For instance,
 * an "outdoor" query would result in the following query string:
 * "?query=outdoor"
 */
export const getItemUrlForFilter = (filter: Filter): string => {
    const queryParams = {
        [getUrlParamNameForFilter(filter)]: filter.name,
        ...((filter.type === FilterType.COUNTRY ||
            filter.type === FilterType.TOPIC) && {
            [SearchUrlParam.RESULT_TYPE]: SearchResultType.ALL,
        }),
    }
    return `${BAKED_BASE_URL}${SEARCH_BASE_PATH}${queryParamsToStr(queryParams)}`
}

export function getPageTypeNameAndIcon(pageType: PageType): {
    name: string
    icon: IconDefinition
} {
    return match(pageType)
        .with(OwidGdocType.AboutPage, () => ({
            name: "About",
            icon: faFileLines,
        }))
        .with(OwidGdocType.Article, () => ({ name: "Article", icon: faBook }))
        .with(OwidGdocType.DataInsight, () => ({
            name: "Data Insight",
            icon: faLightbulb,
        }))
        .with(OwidGdocType.LinearTopicPage, OwidGdocType.TopicPage, () => ({
            name: "Topic page",
            icon: faBookmark,
        }))
        .with(WordpressPageType.Country, () => ({
            name: "Country",
            icon: faGlobe,
        }))
        .with(
            WordpressPageType.Other,
            OwidGdocType.Author, // Should never be indexed
            OwidGdocType.Fragment, // Should never be indexed
            OwidGdocType.Homepage, // Should never be indexed
            () => ({ name: "", icon: faFileLines })
        )
        .exhaustive()
}
export const SEARCH_BASE_PATH = "/data"
