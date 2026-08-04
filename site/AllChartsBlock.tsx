import { useMemo, useState, useEffect, Fragment } from "react"
import { useQuery, keepPreviousData } from "@tanstack/react-query"
import cx from "clsx"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import {
    faArrowRight,
    faMagnifyingGlass,
    faTimesCircle,
} from "@fortawesome/free-solid-svg-icons"
import { useDebounceValue } from "usehooks-ts"
import {
    SearchResultType,
    SearchChartHit,
    FilterType,
    ALL_CHARTS_ID,
} from "@ourworldindata/types"
import { listedRegionsNames } from "@ourworldindata/utils"
import { Button } from "@ourworldindata/components"
import { GrapherWithFallback } from "./GrapherWithFallback.js"
import { useDocumentContext } from "./gdocs/DocumentContext.js"
import { getLiteSearchClient } from "./search/searchClients.js"
import { queryAllCharts, searchQueryKeys } from "./search/queries.js"
import {
    createTopicFilter,
    createCountryFilter,
    createDatasetProducerFilter,
    constructConfigUrl,
    constructChartUrl,
    getEntityQueryStr,
    extractFiltersFromQuery,
    pickEntitiesForChartHit,
    sortHitsByBaselineOrder,
    getChartHitIdentity,
    resolveSelectedChartIndex,
    getFilterIcon,
    getFilterAriaLabel,
    SEARCH_BASE_PATH,
} from "./search/searchUtils.js"
import { stateToSearchParams } from "./search/searchState.js"
import { buildSynonymMap } from "./search/synonymUtils.js"
import { SearchDataResultsSkeleton } from "./search/SearchDataResultsSkeleton.js"
import { SearchFilterPill } from "./search/SearchFilterPill.js"

const SEARCH_DEBOUNCE_MS = 200

const SEARCH_PLACEHOLDER =
    "Search indicators by name, keyword, country, or source…"

// A "suggested" chip must recur across at least this many charts on the
// topic to be worth surfacing — otherwise it's just noise from a single
// indicator rather than a genuine shortcut into the topic's chart list.
const MIN_SUGGESTED_CHIP_COUNT = 2
const MAX_SUGGESTED_CHIPS = 5

// Cap on how many of the auto-suggested chips are countries — the rest of
// the budget goes to keyword chips (see below), with producers only used to
// top up the list if there isn't enough keyword variety.
const MAX_SUGGESTED_COUNTRY_CHIPS = 2

// Shortest a keyword must be to be worth suggesting on its own (drops noise
// like short acronyms picked up mid-title).
const MIN_KEYWORD_LENGTH = 3

// General English stop words, plus words that are technically accurate but
// too generic/boilerplate in OWID chart titles & subtitles to read as a
// meaningful search suggestion on their own (e.g. every chart on a topic
// might say "rate" or "number", but that's not a useful way to search
// within it — "deaths" or "fertility" is). Deliberately erring towards
// excluding borderline words: a shorter, higher-signal chip list beats a
// longer, noisier one.
const KEYWORD_STOP_WORDS = new Set([
    // general English stop words / connectives
    "the",
    "a",
    "an",
    "of",
    "and",
    "or",
    "in",
    "on",
    "at",
    "by",
    "to",
    "for",
    "with",
    "from",
    "per",
    "vs",
    "is",
    "are",
    "was",
    "were",
    "be",
    "been",
    "being",
    "as",
    "it",
    "its",
    "this",
    "that",
    "these",
    "those",
    "than",
    "then",
    "so",
    "such",
    "which",
    "who",
    "whom",
    "what",
    "when",
    "where",
    "how",
    "why",
    "all",
    "any",
    "each",
    "other",
    "some",
    "most",
    "more",
    "less",
    "least",
    "much",
    "many",
    "few",
    "between",
    "among",
    "during",
    "after",
    "before",
    "above",
    "below",
    "up",
    "down",
    "out",
    "off",
    "over",
    "under",
    "again",
    "further",
    "once",
    "here",
    "there",
    "own",
    "same",
    "if",
    "because",
    "while",
    "about",
    "not",
    "no",
    "yes",
    "their",
    "our",
    "you",
    "your",
    // OWID chart-title/subtitle boilerplate: technically descriptive, but too
    // generic to be a useful search shortcut within an already-filtered topic
    "rate",
    "rates",
    "number",
    "numbers",
    "share",
    "shares",
    "total",
    "totals",
    "average",
    "averages",
    "annual",
    "annually",
    "data",
    "world",
    "global",
    "country",
    "countries",
    "region",
    "regions",
    "population",
    "level",
    "levels",
    "value",
    "values",
    "index",
    "indicator",
    "indicators",
    "estimate",
    "estimates",
    "estimated",
    "projection",
    "projections",
    "projected",
    "million",
    "millions",
    "thousand",
    "thousands",
    "billion",
    "billions",
    "measure",
    "measured",
    "measurement",
    "capita",
    "year",
    "years",
    "group",
    "groups",
    "type",
    "types",
])

type SuggestedChipCandidate = {
    dimension: "country" | "producer" | "keyword"
    name: string
    count: number
}

// Splits free text into lowercase word tokens, keeping only alphabetic runs
// (numbers/punctuation are dropped entirely, so "1950-2023" or "(%)" never
// become spurious "tokens").
function splitIntoLowercaseWords(text: string): string[] {
    return text.toLowerCase().match(/[a-z]+/g) ?? []
}

export type SuggestedChip = {
    key: string
    label: string
    onClick: () => void
}

function rankByFrequency(
    counts: Map<string, number>,
    dimension: SuggestedChipCandidate["dimension"]
): SuggestedChipCandidate[] {
    return Array.from(counts.entries())
        .filter(([, count]) => count >= MIN_SUGGESTED_CHIP_COUNT)
        .sort(
            ([nameA, countA], [nameB, countB]) =>
                countB - countA || nameA.localeCompare(nameB)
        )
        .map(([name, count]) => ({ dimension, name, count }))
}

/**
 * Client-side pass over a topic's full chart list, deriving ~4-5 "suggested
 * search" chips from per-chart data Algolia already returns for this block
 * (see DATA_CATALOG_ATTRIBUTES): the countries/entities a chart has data for
 * (`availableEntities`/`originalAvailableEntities`), significant keywords
 * pulled from its `title`/`subtitle` text, and its data producers
 * (`datasetProducers`).
 *
 * An earlier version of this used the chart's topic `tags` for the
 * non-country chips, but those tend to read as generic category labels
 * (dataset/producer names, broad sub-topics) rather than the kind of
 * specific, human search term a visitor would actually type — the design
 * brief's own examples ("deaths", "births") are words you'd find in a chart
 * *title*, not in its tag list. Extracting frequent significant words
 * straight from titles/subtitles gets much closer to that: for a topic like
 * "Population Growth", a chart titled "Births and deaths per year" now
 * contributes "births" and "deaths" as candidate chips, rather than a tag
 * like "Life Expectancy" or a producer like "UN WPP".
 *
 * To match the design brief's mix of a couple of countries plus specific
 * topical terms (e.g. "Spain, Japan, deaths, births, fertility"), country
 * chips are capped at two, remaining slots are filled with the most frequent
 * keywords first, and producers are only used to top up the list when there
 * isn't enough keyword variety.
 */
function computeAutoSuggestedChips(
    hits: SearchChartHit[],
    regionNames: string[],
    topicName: string
): SuggestedChipCandidate[] {
    if (hits.length === 0) return []

    const regionNameSet = new Set(regionNames)
    const countryCounts = new Map<string, number>()
    const producerCounts = new Map<string, number>()
    const keywordCounts = new Map<string, number>()

    // Words already in the topic's own name shouldn't turn back around as a
    // suggested chip — searching "Age" on the "Age Structure" topic page
    // wouldn't narrow anything down.
    const topicNameWords = new Set(splitIntoLowercaseWords(topicName))

    for (const hit of hits) {
        const entities = hit.originalAvailableEntities ?? hit.availableEntities
        const countriesOnChart = new Set(
            (entities ?? []).filter((entity) => regionNameSet.has(entity))
        )
        for (const country of countriesOnChart) {
            countryCounts.set(country, (countryCounts.get(country) ?? 0) + 1)
        }

        const producersOnChart = new Set(hit.datasetProducers ?? [])
        for (const producer of producersOnChart) {
            producerCounts.set(
                producer,
                (producerCounts.get(producer) ?? 0) + 1
            )
        }

        // Significant words from the chart's own title/subtitle — the most
        // specific, human-readable description of what the chart actually
        // shows. Counted as a set per chart (like the dimensions above) so a
        // single title repeating a word doesn't outweigh many different
        // charts mentioning it once each.
        const text = [hit.title, hit.subtitle].filter(Boolean).join(" ")
        const keywordsOnChart = new Set(
            splitIntoLowercaseWords(text).filter(
                (word) =>
                    word.length >= MIN_KEYWORD_LENGTH &&
                    !KEYWORD_STOP_WORDS.has(word) &&
                    !topicNameWords.has(word)
            )
        )
        for (const keyword of keywordsOnChart) {
            keywordCounts.set(keyword, (keywordCounts.get(keyword) ?? 0) + 1)
        }
    }

    const topCountries = rankByFrequency(countryCounts, "country")
    const topProducers = rankByFrequency(producerCounts, "producer")
    const topKeywords = rankByFrequency(keywordCounts, "keyword")

    // At most two country chips (both must still clear the frequency
    // threshold applied above), then prefer specific title/subtitle keywords
    // for the remaining slots, falling back to producers only if there isn't
    // enough keyword variety to fill out the list.
    // `slice` already returns a fresh array, safe for the `push`es below.
    const chips: SuggestedChipCandidate[] = topCountries.slice(
        0,
        MAX_SUGGESTED_COUNTRY_CHIPS
    )

    for (const keyword of topKeywords) {
        if (chips.length >= MAX_SUGGESTED_CHIPS) break
        chips.push(keyword)
    }

    for (const producer of topProducers) {
        if (chips.length >= MAX_SUGGESTED_CHIPS) break
        chips.push(producer)
    }

    return chips.slice(0, MAX_SUGGESTED_CHIPS)
}

export type AllChartsBlockProps = {
    topicName: string
    // Editorially curated search-suggestion chips (from the gdoc block).
    // Optional — when omitted, chips are auto-generated from the topic's
    // chart data instead (see `computeAutoSuggestedChips`).
    suggested?: string[]
    className?: string
    id?: string
}

/**
 * Algolia-powered redesign of the gdoc "all-charts" block. Renders a two-pane
 * layout: a contextual search + selectable results table on the left, and a
 * live Grapher "sidecar" of the selected indicator on the right. The topic
 * facet is always applied, so this is a find/filter within the topic rather
 * than a full-site search.
 */
export const AllChartsBlock = ({
    topicName,
    suggested = [],
    className,
    id = ALL_CHARTS_ID,
}: AllChartsBlockProps) => {
    const liteSearchClient = getLiteSearchClient()

    const [query, setQuery] = useState("")
    const [debouncedQuery] = useDebounceValue(query, SEARCH_DEBOUNCE_MS)

    // Active producer ("source") filters, mirroring the global search's
    // `datasetProducers` facet as a removable pill below the search input.
    // Nothing in this block currently adds to this list — suggested chips
    // (including producer-derived ones) now populate the search input
    // instead of applying a structured filter — but the state and its
    // removal handler stay in place in case a future manually-applied
    // filter UI needs them.
    const [producerFilters, setProducerFilters] = useState<string[]>([])
    const removeProducerFilter = (producer: string) =>
        setProducerFilters((prev) => prev.filter((p) => p !== producer))

    // Region names and synonym map are needed to detect a country mentioned in
    // the query, reusing the same infrastructure as the search page.
    const regionNames = useMemo(() => listedRegionsNames(), [])
    const synonymMap = useMemo(() => buildSynonymMap(), [])

    // Detect a country in the query so we can (a) apply a country facet filter,
    // (b) preselect that entity in the sidecar Grapher, and (c) show a
    // "shown on chart" tag on rows that support it.
    const detectedCountries = useMemo(() => {
        if (!debouncedQuery.trim()) return []
        const filters = extractFiltersFromQuery(
            debouncedQuery,
            regionNames,
            [], // do not detect topics — the topic is fixed
            [],
            { threshold: 1, limit: 1 }, // exact matches only
            synonymMap
        )
        return filters
            .filter((f) => f.type === FilterType.COUNTRY)
            .map((f) => f.name)
    }, [debouncedQuery, regionNames, synonymMap])

    const searchState = useMemo(() => {
        const countryFilters = detectedCountries.map((country) =>
            createCountryFilter(country)
        )
        const datasetProducerFilters = producerFilters.map((producer) =>
            createDatasetProducerFilter(producer)
        )
        return {
            query: debouncedQuery,
            filters: [
                createTopicFilter(topicName),
                ...countryFilters,
                ...datasetProducerFilters,
            ],
            requireAllCountries: false,
            resultType: SearchResultType.DATA,
        }
    }, [debouncedQuery, detectedCountries, producerFilters, topicName])

    // `placeholderData: keepPreviousData` (the same pattern already used for
    // paginated results in site/latest/latestHooks.ts) keeps the previous
    // result set — and the sidecar chart it drives — on screen while a new
    // debounced query is in flight, rather than `isLoading` flipping true and
    // unmounting the table/chart in favour of a skeleton/blank state on every
    // keystroke. The list only actually changes once new data arrives, so
    // typing produces one clean transition instead of a flash-to-empty on
    // every debounce tick.
    const { data, isLoading, isFetching, isError } = useQuery({
        queryKey: searchQueryKeys.charts(searchState),
        queryFn: () => queryAllCharts(liteSearchClient, searchState),
        enabled: Boolean(topicName),
        placeholderData: keepPreviousData,
    })

    // A second, stable "topic only" query (no text/country/producer filters)
    // used purely to derive the suggested chips below the search box. Basing
    // the chips on this baseline rather than the live, filtered `hits` above
    // means they stay put as shortcuts back into the full list instead of
    // shrinking or reordering as the visitor narrows their search. When no
    // filters are active yet (the common initial state), this shares its
    // cache entry — and network request — with the query above.
    const baseSearchState = useMemo(
        () => ({
            query: "",
            filters: [createTopicFilter(topicName)],
            requireAllCountries: false,
            resultType: SearchResultType.DATA,
        }),
        [topicName]
    )

    const { data: baseHits, isError: isBaseError } = useQuery({
        queryKey: searchQueryKeys.charts(baseSearchState),
        // `title`/`subtitle` (used by computeAutoSuggestedChips for its
        // keyword chips) are already part of the shared
        // DATA_CATALOG_ATTRIBUTES, so no extra attributes need requesting
        // here (contrast the old tag-based chips, which needed an explicit
        // extra `tags` attribute).
        queryFn: () => queryAllCharts(liteSearchClient, baseSearchState),
        enabled: Boolean(topicName),
        placeholderData: keepPreviousData,
    })

    const autoSuggestedChips = useMemo(
        () => computeAutoSuggestedChips(baseHits ?? [], regionNames, topicName),
        [baseHits, regionNames, topicName]
    )

    // Searching must narrow this list without ever re-ordering it.
    //
    // Algolia ranks every result set by relevance to the query text, so each
    // keystroke both narrows the list and re-ranks whatever survives. In this
    // block that reads as the rows jumping around unprompted while you type,
    // so the block's *default* order is pinned instead: rows always appear in
    // the relative order they have in `baseHits`, the unfiltered topic-only
    // result set already fetched above for the suggested chips (so this needs
    // no extra request). That holds for every query — a country, a keyword, or
    // a half-typed prefix on the way to either — because a prefix like "chi"
    // is just as much a query as "china" is, and an order that only settles
    // once the text happens to resolve to something recognised is exactly the
    // reshuffle being complained about. Filtering still applies; only the
    // ordering is pinned.
    //
    // Rows are matched to the baseline by chart identity rather than by
    // `objectID`, which matters more than it sounds: the first keystroke makes
    // the shared facet builder add `isFM:false`, swapping the Featured Metric
    // record for several of this topic's top charts for the plain record of the
    // same chart under a different objectID. Keyed on objectID those charts
    // read as new rows and land at the bottom of the list — the top of the
    // list appearing to empty out. See getChartHitIdentity.
    const isBaselinePending = !baseHits && !isBaseError
    const hits = useMemo(() => {
        const rawHits = data ?? []
        // No baseline and none coming: with nothing to pin the order to, fall
        // back to Algolia's order rather than blanking the block for good. No
        // later reshuffle can follow, since no baseline will arrive.
        if (isBaseError) return rawHits
        // Baseline still in flight. Render nothing rather than the raw,
        // relevance-ordered list, which would visibly reshuffle the moment the
        // baseline landed. In practice this window is empty: with no filters
        // applied the two queries share a cache entry, so on first load the
        // baseline arrives with (or before) the filtered results.
        if (!baseHits) return []
        return sortHitsByBaselineOrder(rawHits, baseHits)
    }, [data, baseHits, isBaseError])

    // Editorially curated suggestions (set on the gdoc block) take precedence
    // when present, preserving the pre-existing authoring workflow. Every
    // chip — curated or auto-generated, whatever dimension it came from
    // (country, keyword, or producer) — does exactly one thing when clicked:
    // populate the search input with its label, so it drives the same
    // full-text search path as if the visitor had typed it themselves. This
    // used to differ by dimension (a producer chip applied a structured
    // `datasetProducers` filter shown as a separate pill below the input
    // instead), which made suggestion clicks behave inconsistently; now
    // they're uniform. Chips whose term is already reflected in the current
    // query/filters are hidden rather than shown a second time.
    const suggestedChips: SuggestedChip[] = useMemo(() => {
        if (suggested.length > 0) {
            return suggested.map((text) => ({
                key: `query:${text}`,
                label: text,
                onClick: () => setQuery(text),
            }))
        }
        return autoSuggestedChips
            .filter((chip) => {
                if (chip.dimension === "producer")
                    return !producerFilters.includes(chip.name)
                if (chip.dimension === "country")
                    return !detectedCountries.includes(chip.name)
                return query.trim().toLowerCase() !== chip.name.toLowerCase()
            })
            .map((chip) => ({
                key: `${chip.dimension}:${chip.name}`,
                label: chip.name,
                onClick: () => setQuery(chip.name),
            }))
    }, [
        suggested,
        autoSuggestedChips,
        producerFilters,
        detectedCountries,
        query,
    ])

    if (isError || !topicName) return null

    return (
        <section className={cx(className, "all-charts-block")} id={id}>
            <h1 className="h1-semibold all-charts-block__heading">
                <span>All charts on {topicName}</span>
                <a className="deep-link" aria-labelledby={id} href={`#${id}`} />
            </h1>
            <div className="all-charts-block__panes">
                <AllChartsLeftPane
                    query={query}
                    onQueryChange={setQuery}
                    suggestedChips={suggestedChips}
                    hits={hits}
                    // The skeleton also covers the window where the results
                    // are in but the baseline that orders them isn't (see
                    // `hits` above), so the list is never shown in an order
                    // that's about to change.
                    isLoading={isLoading || isBaselinePending}
                    isFetching={isFetching}
                    detectedCountries={detectedCountries}
                    producerFilters={producerFilters}
                    onRemoveProducerFilter={removeProducerFilter}
                    topicName={topicName}
                    searchParams={stateToSearchParams(searchState)}
                />
            </div>
        </section>
    )
}

type AllChartsLeftPaneProps = {
    query: string
    onQueryChange: (query: string) => void
    suggestedChips: SuggestedChip[]
    hits: SearchChartHit[]
    isLoading: boolean
    isFetching: boolean
    detectedCountries: string[]
    producerFilters: string[]
    onRemoveProducerFilter: (producer: string) => void
    topicName: string
    searchParams: URLSearchParams
}

const AllChartsLeftPane = (props: AllChartsLeftPaneProps) => {
    const {
        query,
        onQueryChange,
        suggestedChips,
        hits,
        isLoading,
        isFetching,
        detectedCountries,
        producerFilters,
        onRemoveProducerFilter,
        topicName,
        searchParams,
    } = props

    // The selected row is remembered by *which chart* it is, not by where it
    // sits in the list, so that searching narrows the list around the chart
    // the visitor is already reading instead of throwing them back to the top
    // of it. Typing a country keeps the selected chart selected — and keeps it
    // in the sidecar — for as long as that chart survives the filter, however
    // far up the list it moves; only a query that filters it out entirely
    // moves the selection, and then to the first surviving row.
    //
    // Identity rather than `objectID` for the same reason the row ordering
    // uses it (see getChartHitIdentity): the first keystroke swaps the
    // Featured Metric record of several of this topic's charts for the plain
    // record of the same chart, so an objectID-keyed selection would be lost
    // on the very first character typed even when the visible list hasn't
    // changed at all.
    //
    // `null` means "nothing picked yet", which resolves to the first row: the
    // block opens with row 1 selected and its chart in the sidecar.
    const [selectedIdentity, setSelectedIdentity] = useState<string | null>(
        null
    )

    // The one place identity is turned back into an index, so the row
    // highlighting, the mobile accordion and the sidecar can't disagree about
    // which row is selected. See resolveSelectedChartIndex for the fallbacks.
    const selectedIndex = useMemo(
        () => resolveSelectedChartIndex(hits, selectedIdentity),
        [hits, selectedIdentity]
    )

    // Keyed on chart identity rather than on `objectID` so the FM→plain record
    // swap on the first keystroke doesn't read as a new result set (see
    // getChartHitIdentity).
    const resultKey = hits.map(getChartHitIdentity).join("~")

    // On narrow viewports the persistent chart sidecar (all-charts-block__right)
    // is hidden in favour of an accordion: clicking a row expands an inline
    // chart directly beneath it, and clicking it again (or another row)
    // collapses it. `null` means no row is expanded. This is independent of
    // `selectedIndex` (which continues to drive the desktop sidecar) so a
    // fresh result set always starts fully collapsed on mobile.
    const [expandedIndex, setExpandedIndex] = useState<number | null>(null)
    useEffect(() => {
        setExpandedIndex(null)
    }, [resultKey])

    const handleRowClick = (index: number) => {
        const hit = hits[index]
        if (hit) setSelectedIdentity(getChartHitIdentity(hit))
        setExpandedIndex((prev) => (prev === index ? null : index))
    }

    const selectedHit = hits[selectedIndex]

    return (
        <>
            <div className="all-charts-block__left">
                <AllChartsSearchInput
                    query={query}
                    onQueryChange={onQueryChange}
                    producerFilters={producerFilters}
                    onRemoveProducerFilter={onRemoveProducerFilter}
                />
                {suggestedChips.length > 0 && (
                    <div className="all-charts-block__suggested">
                        <span className="all-charts-block__suggested-label">
                            Suggested:{" "}
                        </span>
                        {suggestedChips.map((chip, index) => (
                            <Fragment key={chip.key}>
                                <button
                                    type="button"
                                    className="all-charts-block__suggested-link"
                                    onClick={chip.onClick}
                                >
                                    {chip.label}
                                </button>
                                {index < suggestedChips.length - 1 && ", "}
                            </Fragment>
                        ))}
                    </div>
                )}
                {isLoading ? (
                    <SearchDataResultsSkeleton />
                ) : hits.length === 0 ? (
                    <AllChartsEmptyState
                        query={query}
                        topicName={topicName}
                        searchParams={searchParams}
                    />
                ) : (
                    <AllChartsTable
                        hits={hits}
                        selectedIndex={selectedIndex}
                        expandedIndex={expandedIndex}
                        onRowClick={handleRowClick}
                        detectedCountries={detectedCountries}
                        // True while a new debounced query is fetching in the
                        // background (see the keepPreviousData note above) —
                        // a subtle dim on the still-visible previous results,
                        // rather than the skeleton/blank state `isLoading`
                        // triggers on a genuine first load.
                        isRefreshing={isFetching && !isLoading}
                    />
                )}
            </div>
            <div className="all-charts-block__right">
                {selectedHit && (
                    <AllChartsSidecar
                        hit={selectedHit}
                        detectedCountries={detectedCountries}
                    />
                )}
            </div>
        </>
    )
}

const AllChartsSearchInput = ({
    query,
    onQueryChange,
    producerFilters,
    onRemoveProducerFilter,
}: {
    query: string
    onQueryChange: (query: string) => void
    producerFilters: string[]
    onRemoveProducerFilter: (producer: string) => void
}) => {
    return (
        <>
            <div className="all-charts-block__search">
                <FontAwesomeIcon
                    className="all-charts-block__search-icon"
                    icon={faMagnifyingGlass}
                />
                <input
                    type="search"
                    className="all-charts-block__search-input"
                    placeholder={SEARCH_PLACEHOLDER}
                    aria-label={SEARCH_PLACEHOLDER}
                    value={query}
                    onChange={(e) => onQueryChange(e.target.value)}
                />
                {query && (
                    <button
                        type="button"
                        className="all-charts-block__search-clear-button"
                        aria-label="Clear search"
                        onClick={() => onQueryChange("")}
                    >
                        <FontAwesomeIcon icon={faTimesCircle} />
                    </button>
                )}
            </div>
            {producerFilters.length > 0 && (
                <div className="all-charts-block__active-filters">
                    {producerFilters.map((producer) => {
                        const filter = createDatasetProducerFilter(producer)
                        return (
                            <button
                                key={producer}
                                type="button"
                                className="all-charts-block__active-filter-button"
                                aria-label={getFilterAriaLabel(
                                    filter,
                                    "remove"
                                )}
                                onClick={() => onRemoveProducerFilter(producer)}
                            >
                                <SearchFilterPill
                                    name={producer}
                                    icon={getFilterIcon(filter)}
                                    selected
                                />
                            </button>
                        )
                    })}
                </div>
            )}
        </>
    )
}

const AllChartsTable = ({
    hits,
    selectedIndex,
    expandedIndex,
    onRowClick,
    detectedCountries,
    isRefreshing,
}: {
    hits: SearchChartHit[]
    selectedIndex: number
    expandedIndex: number | null
    onRowClick: (index: number) => void
    detectedCountries: string[]
    isRefreshing: boolean
}) => {
    return (
        <ul
            className={cx("all-charts-block__table", {
                "all-charts-block__table--refreshing": isRefreshing,
            })}
            role="list"
        >
            {hits.map((hit, index) => (
                <AllChartsTableRow
                    // Chart identity, not `objectID`: the first keystroke
                    // swaps the Featured Metric record of some of this topic's
                    // charts for the plain record of the same chart, and an
                    // objectID key would tear down and rebuild those rows —
                    // including any chart mounted inside them — for a swap
                    // that changes nothing on screen. See getChartHitIdentity.
                    key={getChartHitIdentity(hit)}
                    hit={hit}
                    isSelected={index === selectedIndex}
                    isExpanded={index === expandedIndex}
                    onSelect={() => onRowClick(index)}
                    detectedCountries={detectedCountries}
                />
            ))}
        </ul>
    )
}

/**
 * The Grapher view the sidecar is showing for a hit, as a query string — e.g.
 * "?country=~ESP" when the search names a country this chart has data for, and
 * "" when it doesn't.
 *
 * Deliberately the single source of that string. `AllChartsSidecar` hands it
 * to `GrapherWithFallback` to render the chart, and the row's "Explore the
 * data" link puts the very same string on its href, so following the link
 * opens the chart page on the view the sidecar was showing — country selected
 * and all — rather than on the bare chart. Rebuilding an equivalent param list
 * for the link separately would be free to drift from what the sidecar
 * actually applied; both callers passing identical arguments to one function
 * can't.
 */
function getSidecarViewQueryStr(
    hit: SearchChartHit,
    detectedCountries: string[]
): string {
    return getEntityQueryStr(pickEntitiesForChartHit(hit, detectedCountries))
}

const AllChartsTableRow = ({
    hit,
    isSelected,
    isExpanded,
    onSelect,
    detectedCountries,
}: {
    hit: SearchChartHit
    isSelected: boolean
    isExpanded: boolean
    onSelect: () => void
    detectedCountries: string[]
}) => {
    // Entities from the query that are actually available on this chart.
    const shownEntities = pickEntitiesForChartHit(hit, detectedCountries)

    // Carries the sidecar's current view (the selected country) through to the
    // chart page, so "Explore the data" lands on the same thing the visitor is
    // already looking at instead of resetting to the chart's default entities.
    const chartUrl = constructChartUrl({
        hit,
        grapherQueryStr: getSidecarViewQueryStr(hit, detectedCountries),
    })

    // Rendered as a single "Source: …" line under the subtitle (see below)
    // rather than in a column of its own, so the row reads as one block of
    // text instead of a table cell.
    const source = (hit.datasetProducers ?? []).join(", ")

    // Enter/Space activate the row the same way a native <button> would —
    // needed because the click target below is a div (it wraps a multi-line
    // stack of title/subtitle/source spans rather than being a leaf control),
    // so we reimplement that bit of native button keyboard behavior ourselves.
    const handleRowKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault()
            onSelect()
        }
    }

    return (
        <li
            className={cx("all-charts-block__row", {
                "all-charts-block__row--selected": isSelected,
            })}
        >
            <div className="all-charts-block__row-body">
                {/* The row's text stack is a single click/keyboard target for
                    selecting the row on desktop or expanding/collapsing its
                    mobile accordion. The "Explore the data" link below is a
                    sibling rather than a child so its own click never has to
                    be stopped from bubbling into this handler. */}
                <div
                    className="all-charts-block__row-main"
                    role="button"
                    tabIndex={0}
                    aria-pressed={isSelected}
                    aria-expanded={isExpanded}
                    onClick={onSelect}
                    onKeyDown={handleRowKeyDown}
                >
                    <span className="all-charts-block__row-title">
                        {hit.title}
                    </span>
                    {hit.subtitle && (
                        <span className="all-charts-block__row-subtitle">
                            {hit.subtitle}
                        </span>
                    )}
                    {source && (
                        <span className="all-charts-block__row-source">
                            {/* The label and the producer list are separate
                                elements so the list can be truncated to one
                                line on its own while "Source:" stays whole. */}
                            <span className="all-charts-block__row-source-label">
                                Source:
                            </span>
                            <span className="all-charts-block__row-source-value">
                                {source}
                            </span>
                        </span>
                    )}
                    {shownEntities.length > 0 && (
                        <span className="all-charts-block__row-tag">
                            {shownEntities.join(", ")}
                        </span>
                    )}
                </div>
                {/* Shown on the selected row only: once a visitor has picked a
                    row (and is looking at its chart, in the sidecar on desktop
                    or the accordion below on mobile), this is the way on to
                    the chart's own page. Its own navigation action, distinct
                    from selecting/expanding the row. */}
                {isSelected && (
                    <div className="all-charts-block__row-action">
                        <Button
                            // $blue-60, matching the "SUGGESTED:" links and
                            // the button fill in the designer's mockup.
                            theme="solid-blue"
                            className="all-charts-block__row-explore-button"
                            text="Explore the data"
                            href={chartUrl}
                            ariaLabel={`Explore the data on ${hit.title}`}
                            dataTrackNote="all-charts-row-explore"
                            icon={faArrowRight}
                            iconPosition="right"
                        />
                    </div>
                )}
            </div>
            {/* Mobile/tablet accordion panel: the persistent sidecar
                (all-charts-block__right) is hidden below that breakpoint, so
                the selected row's chart is shown inline underneath it
                instead. Rendered only while expanded so the chart isn't
                mounted (and fetched) until a visitor actually opens it. */}
            {isExpanded && (
                <div className="all-charts-block__row-accordion">
                    <AllChartsSidecar
                        hit={hit}
                        detectedCountries={detectedCountries}
                    />
                </div>
            )}
        </li>
    )
}

const AllChartsSidecar = ({
    hit,
    detectedCountries,
}: {
    hit: SearchChartHit
    detectedCountries: string[]
}) => {
    const { isPreviewing } = useDocumentContext()

    // The search field's country selection takes precedence over Grapher's own
    // entity selector. A new search resets it (the queryStr changes), but we
    // don't track entity changes made inside Grapher back to the search bar.
    // Shared with the row's "Explore the data" href — see
    // getSidecarViewQueryStr.
    const queryStr = getSidecarViewQueryStr(hit, detectedCountries)

    // Plain charts can be loaded by slug; mdim/explorer views need a config URL.
    const configUrl =
        hit.type === "chart" ? undefined : constructConfigUrl({ hit })

    return (
        <GrapherWithFallback
            // Remount when the selected indicator *or* the view of it changes
            // so Grapher fully re-initializes (config, tabs, entity
            // selection) — in particular, picking up a newly detected country
            // in `queryStr`, which Grapher only reads at initialization.
            //
            // The chart half of that key is its identity rather than its
            // `objectID`, so the FM→plain record swap on the first keystroke
            // no longer counts as a change of chart: without this the sidecar
            // remounted and restarted its loading spinner while the visitor
            // typed, blanking a chart that hadn't actually changed. The
            // `queryStr` half is unchanged, so a change of country still
            // remounts and re-applies the entity selection.
            key={`${getChartHitIdentity(hit)}${queryStr}`}
            slug={hit.type === "chart" ? hit.slug : undefined}
            configUrl={configUrl}
            className="all-charts-block__grapher"
            id={`all-charts-grapher-${hit.objectID}`}
            queryStr={queryStr}
            enablePopulatingUrlParams={false}
            isEmbeddedInAnOwidPage={true}
            isEmbeddedInADataPage={false}
            config={{ enableKeyboardShortcuts: false }}
            isPreviewing={isPreviewing}
        />
    )
}

const AllChartsEmptyState = ({
    query,
    topicName,
    searchParams,
}: {
    query: string
    topicName: string
    searchParams: URLSearchParams
}) => {
    const searchHref = `${SEARCH_BASE_PATH}?${searchParams.toString()}`

    return (
        <div className="all-charts-block__empty">
            <h2 className="all-charts-block__empty-heading">
                No charts found here
            </h2>
            <p className="all-charts-block__empty-text">
                No indicators on {topicName} match “{query}”.
            </p>
            <Button
                theme="solid-vermillion"
                text="Search all charts"
                href={searchHref}
                dataTrackNote="all-charts-search-all"
                icon={faMagnifyingGlass}
                iconPosition="left"
            />
        </div>
    )
}
