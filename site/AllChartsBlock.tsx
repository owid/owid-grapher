import { useMemo, useState, useEffect, Fragment } from "react"
import { useQuery } from "@tanstack/react-query"
import cx from "clsx"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import {
    faArrowRight,
    faMagnifyingGlass,
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
    const chips: SuggestedChipCandidate[] = [
        ...topCountries.slice(0, MAX_SUGGESTED_COUNTRY_CHIPS),
    ]

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

    const { data, isLoading, isError } = useQuery({
        queryKey: searchQueryKeys.charts(searchState),
        queryFn: () => queryAllCharts(liteSearchClient, searchState),
        enabled: Boolean(topicName),
    })

    const hits = data ?? []

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

    const { data: baseHits } = useQuery({
        queryKey: searchQueryKeys.charts(baseSearchState),
        // `title`/`subtitle` (used by computeAutoSuggestedChips for its
        // keyword chips) are already part of the shared
        // DATA_CATALOG_ATTRIBUTES, so no extra attributes need requesting
        // here (contrast the old tag-based chips, which needed an explicit
        // extra `tags` attribute).
        queryFn: () => queryAllCharts(liteSearchClient, baseSearchState),
        enabled: Boolean(topicName),
    })

    const autoSuggestedChips = useMemo(
        () => computeAutoSuggestedChips(baseHits ?? [], regionNames, topicName),
        [baseHits, regionNames, topicName]
    )

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
                    isLoading={isLoading}
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
        detectedCountries,
        producerFilters,
        onRemoveProducerFilter,
        topicName,
        searchParams,
    } = props

    // Index of the selected row. Reset to the first result whenever the result
    // set changes (i.e. a new search runs).
    const [selectedIndex, setSelectedIndex] = useState(0)
    const resultKey = hits.map((hit) => hit.objectID).join("~")
    useEffect(() => {
        setSelectedIndex(0)
    }, [resultKey])

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
        setSelectedIndex(index)
        setExpandedIndex((prev) => (prev === index ? null : index))
    }

    const selectedHit = hits[selectedIndex] ?? hits[0]

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
}: {
    hits: SearchChartHit[]
    selectedIndex: number
    expandedIndex: number | null
    onRowClick: (index: number) => void
    detectedCountries: string[]
}) => {
    return (
        <>
            {/* Column labels, mirroring the row grid below. Hidden on narrow
                viewports, where rows become an accordion instead of a table
                with an aligned source column. */}
            <div className="all-charts-block__table-header" aria-hidden="true">
                <span className="all-charts-block__table-header-label">
                    Indicator
                </span>
                <span className="all-charts-block__table-header-label all-charts-block__table-header-label--source">
                    Source
                </span>
            </div>
            <ul className="all-charts-block__table" role="list">
                {hits.map((hit, index) => (
                    <AllChartsTableRow
                        key={hit.objectID}
                        hit={hit}
                        isSelected={index === selectedIndex}
                        isExpanded={index === expandedIndex}
                        onSelect={() => onRowClick(index)}
                        detectedCountries={detectedCountries}
                    />
                ))}
            </ul>
        </>
    )
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
    const chartUrl = constructChartUrl({ hit })

    // Entities from the query that are actually available on this chart.
    const shownEntities = pickEntitiesForChartHit(hit, detectedCountries)

    const producers = hit.datasetProducers ?? []

    return (
        <li
            className={cx("all-charts-block__row", {
                "all-charts-block__row--selected": isSelected,
            })}
        >
            <div className="all-charts-block__row-main">
                <button
                    type="button"
                    className="all-charts-block__row-button"
                    aria-pressed={isSelected}
                    aria-expanded={isExpanded}
                    onClick={onSelect}
                >
                    <span className="all-charts-block__row-indicator">
                        <span className="all-charts-block__row-title">
                            {hit.title}
                        </span>
                        {hit.subtitle && (
                            <span className="all-charts-block__row-subtitle">
                                {hit.subtitle}
                            </span>
                        )}
                        {shownEntities.length > 0 && (
                            <span className="all-charts-block__row-tag">
                                Shown on chart: {shownEntities.join(", ")}
                            </span>
                        )}
                    </span>
                </button>
                {/* The source column lives outside the row-selection button so
                    clicking it doesn't also select the row. It's plain,
                    non-interactive text (no filter-on-click behavior). */}
                <span className="all-charts-block__row-source">
                    {producers.join(", ")}
                </span>
                <a
                    className="all-charts-block__row-link"
                    href={chartUrl}
                    aria-label={`Open ${hit.title}`}
                    data-track-note="all-charts-row-link"
                >
                    <FontAwesomeIcon icon={faArrowRight} />
                </a>
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
    const selectedEntities = pickEntitiesForChartHit(hit, detectedCountries)
    const queryStr = getEntityQueryStr(selectedEntities)

    // Plain charts can be loaded by slug; mdim/explorer views need a config URL.
    const configUrl =
        hit.type === "chart" ? undefined : constructConfigUrl({ hit })

    return (
        <GrapherWithFallback
            // Remount when the selected indicator changes so Grapher fully
            // re-initializes (config, tabs, entity selection).
            key={`${hit.objectID}${queryStr}`}
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
