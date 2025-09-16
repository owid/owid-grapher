import * as _ from "lodash-es"
import * as R from "remeda"
import { HitAttributeHighlightResult } from "instantsearch.js"
import {
    EntityName,
    GRAPHER_CHART_TYPES,
    GRAPHER_TAB_QUERY_PARAMS,
    GrapherChartType,
    GrapherQueryParams,
    GrapherTabName,
    GrapherTabQueryParam,
    GrapherValuesJson,
    GrapherValuesJsonDataPoint,
    OwidGdocType,
    PrimitiveType,
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
    omitUndefinedValues,
    getRegionByName,
} from "@ourworldindata/utils"
import { type GrapherTrendArrowDirection } from "@ourworldindata/components"
import {
    generateSelectedEntityNamesParam,
    isValidTabQueryParam,
    mapGrapherTabNameToQueryParam,
} from "@ourworldindata/grapher"
import { getIndexName } from "./searchClient.js"
import {
    SearchIndexName,
    Filter,
    FilterType,
    ScoredFilter,
    SearchResultType,
    SearchTopicType,
    SearchFacetFilters,
    ChartRecordType,
    SearchChartHit,
    IChartHit,
    SearchUrlParam,
    SynonymMap,
    Ngram,
    WordPositioned,
    ScoredFilterPositioned,
} from "./searchTypes.js"
import {
    faBook,
    faBookmark,
    faBullhorn,
    faFileLines,
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
    EXPLORER_DYNAMIC_CONFIG_URL,
    EXPLORER_DYNAMIC_THUMBNAIL_URL,
    GRAPHER_DYNAMIC_CONFIG_URL,
    GRAPHER_DYNAMIC_THUMBNAIL_URL,
    MULTI_DIM_DYNAMIC_CONFIG_URL,
} from "../../settings/clientSettings.js"
import { EXPLORERS_ROUTE_FOLDER } from "@ourworldindata/explorer"
import { SearchChartHitDataDisplayProps } from "./SearchChartHitDataDisplay.js"
import { CoreColumn } from "@ourworldindata/core-table"
import { PreviewVariant } from "./SearchChartHitRichDataTypes.js"

// Common English stop words that should be ignored in search
const STOP_WORDS = new Set([
    "the",
    "in", // matches "India"
    "is", // matches "Israel"
    "of",
    "and", // matches "Andorra"
    "a",
    "an",
    "to",
    "for",
    "with",
    "on",
    "at",
    "by",
    "from",
    "per", // matches "Peru"
    "vs",
])

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

    // Reverse the order so that the last picked entity is first
    const sortedEntities = [...pickedEntities].reverse()

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
    overlay,
}: {
    hit: SearchChartHit
    grapherParams?: GrapherQueryParams
    overlay?: "sources" | "download-data"
}): string => {
    const viewQueryStr = generateQueryStrForChartHit({ hit, grapherParams })
    const overlayQueryStr = overlay ? `overlay=${overlay}` : ""
    const queryParts = [
        viewQueryStr?.replace(/^\?/, ""),
        overlayQueryStr,
    ].filter((queryStr) => queryStr)
    const queryStr = queryParts.length > 0 ? `?${queryParts.join("&")}` : ""

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

export const constructPreviewUrl = ({
    hit,
    grapherParams,
    variant,
    isMinimal,
    fontSize,
    imageWidth,
    imageHeight,
}: {
    hit: SearchChartHit
    grapherParams?: GrapherQueryParams
    variant: PreviewVariant
    isMinimal?: boolean
    fontSize?: number
    imageWidth?: number
    imageHeight?: number
}): string => {
    const isExplorerView = hit.type === ChartRecordType.ExplorerView

    const queryStr = generateQueryStrForChartHit({ hit, grapherParams })

    const searchParams = new URLSearchParams(
        omitUndefinedValues({
            imType: variant === "large" ? "uncaptioned" : variant,
            imMinimal: isMinimal ? "1" : "0",
            imFontSize: fontSize?.toString(),
            imWidth: imageWidth?.toString(),
            imHeight: imageHeight?.toString(),
        })
    )
    const fullQueryStr = queryStr
        ? `${queryStr}&${searchParams}`
        : `?${searchParams}`

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
    return match(hit)
        .with(
            { type: ChartRecordType.Chart },
            (hit) => `${GRAPHER_DYNAMIC_CONFIG_URL}/${hit.slug}.config.json`
        )
        .with(
            { type: ChartRecordType.MultiDimView },
            (hit) =>
                `${GRAPHER_DYNAMIC_CONFIG_URL}/by-uuid/${hit.chartConfigId}.config.json`
        )
        .with({ type: ChartRecordType.ExplorerView }, () => {
            const queryStr = generateQueryStrForChartHit({ hit })
            return `${EXPLORER_DYNAMIC_CONFIG_URL}/${hit.slug}.config.json${queryStr}`
        })
        .exhaustive()
}

export const constructMdimConfigUrl = ({
    hit,
}: {
    hit: SearchChartHit
}): string | undefined => {
    const isMultiDimView = hit.type === ChartRecordType.MultiDimView
    if (!isMultiDimView) return undefined
    return `${MULTI_DIM_DYNAMIC_CONFIG_URL}/${hit.slug}.json`
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
    "subtitle",
    "chartConfigId",
    "explorerType",
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
): ScoredFilter[] {
    const searchTerm = words.join(" ")

    const searchCountryTopics = (term: string) => {
        const countryFilters: ScoredFilter[] = FuzzySearch.withKey(
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
                ...createCountryFilter(result.target),
                score: result.score,
            }))

        const topicFilters: ScoredFilter[] =
            selectedTopics.size === 0
                ? FuzzySearch.withKey(allTopics, (topic) => topic, sortOptions)
                      .searchResults(term)
                      .map((result: FuzzySearchResult) => ({
                          ...createTopicFilter(result.target),
                          score: result.score,
                      }))
                : []

        return [...countryFilters, ...topicFilters]
    }

    // 1. Perform original search
    let filters = searchCountryTopics(searchTerm)

    // 2. Search with synonyms
    const synonyms = synonymMap.get(searchTerm.toLowerCase())

    if (synonyms && synonyms.length > 0) {
        // Search with each synonym and combine results
        for (const synonym of synonyms) {
            const filtersFromSynonym = searchCountryTopics(synonym)
            filters.push(...filtersFromSynonym)
        }
    }

    // For each filter type, keep only the top results then recombine into a single array
    filters = R.pipe(
        filters,
        R.groupBy((filter) => filter.type),
        R.values,
        R.flatMap((filtersOfType: ScoredFilter[]) =>
            R.pipe(
                filtersOfType,
                R.sortBy((filter) => -filter.score), // Sort by score descending
                R.uniqueBy((filter) => filter.name),
                R.take(sortOptions.limit)
            )
        )
    )

    return filters
}

/**
 * Performs contiguous substring search on words against countries and topics.
 * Each word in the query must match as a prefix of words in the target names.
 * Handles multi-word queries and synonyms while ensuring contiguous matching.
 *
 * @returns Array of scored filters matching the query words (non deduplicated)
 */
export function searchWithWordsContiguous(
    words: string[],
    allCountryNames: string[],
    allTopics: string[],
    selectedCountryNames: Set<string>,
    selectedTopics: Set<string>,
    synonymMap: SynonymMap
): ScoredFilter[] {
    // Returns true if all query words are prefixes of the target words
    // Example:
    // - ["chi", "mortal"] matches "child mortality" -> true
    // - ["child", "blank"] doesn't match "child mortality" -> false
    const areAllWordsPrefixes = (
        queryWords: string[],
        target: string
    ): boolean => {
        const targetWords = target.toLowerCase().split(/\s+/)
        const queryWordsLower = queryWords.map((word) => word.toLowerCase())

        // Each query word must match as a prefix of some target word
        return queryWordsLower.every((queryWord) =>
            targetWords.some((targetWord) => targetWord.startsWith(queryWord))
        )
    }

    // For countries, require exact covering matches where all query words are covered
    // Example: "east" or "east ti" should NOT match "east timor"
    const isExactCoveringMatch = (
        queryWords: string[],
        target: string
    ): boolean => {
        const query = queryWords.join(" ").toLowerCase()
        return target.toLowerCase() === query
    }

    const searchCountryTopicAsPrefixes = (queryWords: string[]) => {
        const countryFilters: ScoredFilter[] = allCountryNames
            .filter((country) => !selectedCountryNames.has(country))
            .filter((country) => isExactCoveringMatch(queryWords, country))
            .map((country) => ({
                ...createCountryFilter(country),
                score: calculateScore(queryWords, country),
            }))

        const topicFilters: ScoredFilter[] =
            selectedTopics.size === 0
                ? allTopics
                      .filter((topic) => areAllWordsPrefixes(queryWords, topic))
                      .map((topic) => ({
                          ...createTopicFilter(topic),
                          score: calculateScore(queryWords, topic),
                      }))
                : []

        return [...countryFilters, ...topicFilters]
    }

    // 1. Perform original search
    const filters = searchCountryTopicAsPrefixes(words)

    // 2. Search with synonyms
    const searchTerm = words.join(" ").toLowerCase()
    const synonyms = synonymMap.get(searchTerm)

    if (synonyms && synonyms.length > 0) {
        // Search with each synonym and combine results
        for (const synonym of synonyms) {
            const synonymWords = synonym.split(/\s+/)
            const filtersFromSynonym =
                searchCountryTopicAsPrefixes(synonymWords)
            filters.push(...filtersFromSynonym)
        }
    }

    return filters
}

/**
 * Calculate a simple score based on match quality for contiguous matching.
 * Higher scores are given to queries that cover more of the target string.
 *
 * @returns Normalized score between 0 and 1, where 1 represents perfect matches
 */
export function calculateScore(queryWords: string[], target: string): number {
    const targetWords = target.toLowerCase().split(/\s+/)
    const queryWordsLower = queryWords.map((word) => word.toLowerCase())

    let totalMatchedChars = 0
    queryWordsLower.forEach((queryWord) => {
        const matchingWord = targetWords.find((targetWord) =>
            targetWord.startsWith(queryWord)
        )
        if (matchingWord) {
            // Count how many characters of the query word match
            totalMatchedChars += queryWord.length
        }
    })

    // Calculate total length of target (excluding spaces)
    const targetLength = target.replace(/\s+/g, "").length

    // Score is the ratio of matched characters to total target length
    return totalMatchedChars / targetLength
}

/**
 * Detects words that are inside quoted phrases and should be excluded from filter matching.
 * Returns a set of word positions that should be ignored.
 */
function getQuotedWordPositions(words: string[]): Set<number> {
    const quotedPositions = new Set<number>()
    const parts = words
        .join(" ")
        .split(/("[^"]*"|\S+)/)
        .filter(Boolean)

    let wordIndex = 0
    for (const part of parts) {
        if (part.startsWith('"') && part.endsWith('"')) {
            // Count words in the quoted phrase
            const wordCount = part.split(/\s+/).filter(Boolean).length
            for (let i = 0; i < wordCount; i++) {
                quotedPositions.add(wordIndex + i)
            }
            wordIndex += wordCount
        } else if (part.trim()) {
            wordIndex++
        }
    }

    return quotedPositions
}

/**
 * Cousin of findMatches that uses n-gram approach to find matches for all
 * possible combinations of words in the query, not just left-to-right
 * reduction.
 *
 * Generates n-grams from 1 to 4 non stop-words, prioritizing longer phrases over shorter
 * ones. Uses overlap detection to prevent the same word positions from being
 * matched multiple times. Keeps a single country or filter topic per n-gram
 * then deduplicates overall results by name.
 *
 * @returns Array of deduplicated scored filters
 */
export function findMatchesWithNgrams(
    query: string,
    allCountryNames: string[],
    allTopics: string[],
    selectedCountryNames: Set<string>,
    selectedTopics: Set<string>,
    sortOptions: { threshold: number; limit: number },
    synonymMap: SynonymMap
): ScoredFilterPositioned[] {
    const allFilters: ScoredFilterPositioned[] = []
    const matchedWordPositions = new Set<number>()

    const words = splitIntoWords(query)

    // Get positions of words inside quoted phrases
    const quotedWordPositions = getQuotedWordPositions(words)

    // Filter out stop words and quoted words while preserving original positions
    const tokens: WordPositioned[] = words
        .map((word, index) => ({ word, position: index }))
        .filter(({ word }) => isNotStopWord(word))
        .filter(({ position }) => !quotedWordPositions.has(position))

    if (tokens.length === 0) return []

    const ngrams: Ngram[] = []
    const maxNgramSize = Math.min(tokens.length, 4) // Topics and countries mostly fit within 4 words

    // Generate n-grams from largest to smallest to prioritize longer phrases
    for (let n = maxNgramSize; n >= 1; n--) {
        for (let i = 0; i <= tokens.length - n; i++) {
            ngrams.push(tokens.slice(i, i + n))
        }
    }

    // Search each n-gram and collect results, prioritizing longer phrases
    for (const ngram of ngrams) {
        const ngramWords = R.map(ngram, R.prop("word"))
        const ngramPositions = R.map(ngram, R.prop("position"))

        // Check if any original word positions in this n-gram are already matched by a longer phrase
        const hasOverlap =
            ngramPositions.some((pos: number) =>
                matchedWordPositions.has(pos)
            ) ?? false

        if (hasOverlap) continue // Skip this n-gram if it overlaps with already matched words

        const filters = searchWithWords(
            ngramWords,
            allCountryNames,
            allTopics,
            selectedCountryNames,
            selectedTopics,
            sortOptions,
            synonymMap
        )

        const bestFilter = _.maxBy(filters, (f) => f.score)
        if (bestFilter) {
            // Store the original positions for later use in replacement logic
            allFilters.push({
                ...bestFilter,
                positions: ngramPositions,
            })
            // Mark these word positions as matched to prevent overlaps
            ngramPositions.forEach((pos: number) =>
                matchedWordPositions.add(pos)
            )
        }
    }

    return R.uniqueBy(allFilters, (filter) => filter.name)
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
    filters: ScoredFilter[]
    matchStartIndex: number
} {
    const wordsToSearch = words.slice(wordIndex)
    const filters = searchWithWords(
        wordsToSearch,
        allCountryNames,
        allTopics,
        selectedCountryNames,
        selectedTopics,
        sortOptions,
        synonymMap
    )

    if (filters.length > 0) {
        return {
            filters,
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
              filters: [],
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
export function getFilterSuggestionsWithUnmatchedQuery(
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
        // we can afford to be more strict with matching due to the presence of
        // synonyms, in particular country alternatives (e.g. "uk" matches
        // "united kingdom" without the need for a more permissive fuzzy match)
        threshold: 0.75,
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

    const queryWords = splitIntoWords(query)

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

    const countryMatches = searchResults.filters.filter(
        (f) => f.type === FilterType.COUNTRY
    )

    const topicMatches = searchResults.filters.filter(
        (f) => f.type === FilterType.TOPIC
    )

    const allMatches = [...countryMatches, ...topicMatches]

    const [exactMatches, partialMatches] = R.partition(
        allMatches,
        (item) => item.score === 1
    )

    const sortedPartialMatches = partialMatches.sort(
        (a, b) => b.score - a.score
    )

    const primaryFilters = [
        exactMatches,
        ...(query ? [createQueryFilter(query)] : []),
    ]

    const combinedFilters = [
        ...(!unmatchedQuery ? primaryFilters : primaryFilters.reverse()).flat(),
        ...sortedPartialMatches,
    ]

    return {
        suggestions: combinedFilters,
        unmatchedQuery,
    }
}

/**
 * Gets filter suggestions using ngrams for more robust multi-entity matching.
 */
export function getFilterSuggestionsNgrams(
    query: string,
    allTopics: string[],
    filters: Filter[], // currently active filters to exclude from suggestions
    sortOptions: { threshold: number; limit: number },
    synonymMap: SynonymMap
): ScoredFilterPositioned[] {
    if (!query) return []

    const selectedCountryNames = getFilterNamesOfType(
        filters,
        FilterType.COUNTRY
    )
    const selectedTopics = getFilterNamesOfType(filters, FilterType.TOPIC)
    const allCountries = countriesByName()
    const allCountryNames = Object.values(allCountries).map(
        (country) => country.name
    )

    // Use n-gram matching for better phrase detection
    const matches = findMatchesWithNgrams(
        query,
        allCountryNames,
        allTopics,
        selectedCountryNames,
        selectedTopics,
        sortOptions,
        synonymMap
    )

    return matches
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
    const trend = calculateTrendDirection(
        startDatapoint?.value,
        endDatapoint?.value
    )
    const showLocationIcon =
        isEntityPickedByUser && getRegionByName(entity) !== undefined

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

export function calculateTrendDirection(
    startValue?: PrimitiveType,
    endValue?: PrimitiveType
): GrapherTrendArrowDirection | undefined {
    if (typeof startValue !== "number" || typeof endValue !== "number")
        return undefined
    return endValue > startValue
        ? "up"
        : endValue < startValue
          ? "down"
          : "right"
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

export const getUrlParamNameForFilter = (filter: Filter) =>
    match(filter.type)
        .with(FilterType.COUNTRY, () => SearchUrlParam.COUNTRY)
        .with(FilterType.TOPIC, () => SearchUrlParam.TOPIC)
        .with(FilterType.QUERY, () => SearchUrlParam.QUERY)
        .exhaustive()

/**
 * Builds a fully qualified search URL for the provided autocomplete filter.
 *
 * Handles different filter types:
 * - `COUNTRY` or `TOPIC` filters include a `resultType=ALL` parameter to
 *   broaden search results beyond the default data-only view, plus any
 *   unmatched query terms
 * - `QUERY` filters only include the filter parameter itself (defaults to
 *   data-only results)
 *
 * Examples:
 * - Country filter "Kenya" with unmatched query "emissions":
 *   "?country=Kenya&q=emissions&resultType=all" (shows all content types)
 * - Topic filter "Health": "?topic=Health&resultType=all" (shows all content
 *   types)
 * - Query filter "outdoor": "?q=outdoor" (shows data results only)
 */
export const getItemUrlForFilter = (
    filter: Filter,
    unmatchedQuery: string
): string => {
    const filterParam = {
        [getUrlParamNameForFilter(filter)]: filter.name,
    }

    const queryParams = match(filter.type)
        .with(FilterType.COUNTRY, FilterType.TOPIC, () => ({
            ...filterParam,
            ...(unmatchedQuery && {
                [SearchUrlParam.QUERY]: unmatchedQuery,
            }),
            [SearchUrlParam.RESULT_TYPE]: SearchResultType.ALL,
        }))
        .with(FilterType.QUERY, () => filterParam)
        .exhaustive()

    return `${BAKED_BASE_URL}${SEARCH_BASE_PATH}${queryParamsToStr(queryParams)}`
}

export function getPageTypeNameAndIcon(pageType: OwidGdocType): {
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
        .with(OwidGdocType.Announcement, () => ({
            name: "Announcement",
            icon: faBullhorn,
        }))
        .with(
            OwidGdocType.Author, // Should never be indexed
            OwidGdocType.Fragment, // Should never be indexed
            OwidGdocType.Homepage, // Should never be indexed
            () => ({ name: "", icon: faFileLines })
        )
        .exhaustive()
}
export const SEARCH_BASE_PATH = "/search"

export const getPaginationOffsetAndLength = (
    pageParam: number,
    firstPageSize: number,
    laterPageSize: number
) => {
    const offset =
        pageParam === 0 ? 0 : firstPageSize + (pageParam - 1) * laterPageSize
    const length = pageParam === 0 ? firstPageSize : laterPageSize
    return { offset, length }
}

export const getNbPaginatedItemsRequested = (
    currentPageIndex: number,
    firstPageSize: number,
    laterPageSize: number,
    lastPageHits: number
) => {
    return currentPageIndex === 0
        ? firstPageSize
        : firstPageSize + (currentPageIndex - 1) * laterPageSize + lastPageHits
}

/**
 * Helper function to remove matched words and preceding stop words from query
 * when a filter is selected.
 */
export function removeMatchedWordsWithStopWords(
    originalWords: string[],
    matchedPositions: number[]
): string {
    if (!matchedPositions.length) return originalWords.join(" ")

    const wordsToRemove = new Set(matchedPositions)

    // For each matched position, remove any consecutive stop words that immediately precede it
    for (const matchedPos of matchedPositions) {
        // Look backwards from this matched position to remove consecutive preceding stop words
        for (let i = matchedPos - 1; i >= 0; i--) {
            const word = originalWords[i].toLowerCase()
            if (STOP_WORDS.has(word)) {
                wordsToRemove.add(i)
            } else {
                // Stop when we hit a non-stop word
                break
            }
        }
    }

    return originalWords
        .filter((_, index) => !wordsToRemove.has(index))
        .join(" ")
}

export const splitIntoWords = (text: string) => text.trim().split(/\s+/)

export const isNotStopWord = (word: string) =>
    !STOP_WORDS.has(word.toLowerCase())
