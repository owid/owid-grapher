import { useMemo, useState, useEffect } from "react"
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

type SuggestedChipCandidate = {
    dimension: "country" | "producer"
    name: string
    count: number
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
 * search" chips from the two per-chart dimensions Algolia actually returns to
 * the client (see DATA_CATALOG_ATTRIBUTES): the countries/entities a chart
 * has data for (`availableEntities`/`originalAvailableEntities`) and its data
 * producers (`datasetProducers`). There's no per-chart tag/dataset-name field
 * retrieved on the client, so we can't add a third dimension — instead we
 * guarantee one chip for the topic's single most common country and one for
 * its most common producer (mirroring the design brief's "Italy" / producer
 * examples), then fill any remaining slots with the next most frequent
 * countries/producers.
 */
function computeAutoSuggestedChips(
    hits: SearchChartHit[],
    regionNames: string[]
): SuggestedChipCandidate[] {
    if (hits.length === 0) return []

    const regionNameSet = new Set(regionNames)
    const countryCounts = new Map<string, number>()
    const producerCounts = new Map<string, number>()

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
    }

    const topCountries = rankByFrequency(countryCounts, "country")
    const topProducers = rankByFrequency(producerCounts, "producer")

    // Guarantee one country chip and one producer chip (when the data
    // supports it), then fill the rest by frequency regardless of dimension.
    const chips: SuggestedChipCandidate[] = []
    if (topCountries[0]) chips.push(topCountries[0])
    if (topProducers[0]) chips.push(topProducers[0])

    const remaining = [...topCountries.slice(1), ...topProducers.slice(1)].sort(
        (a, b) => b.count - a.count || a.name.localeCompare(b.name)
    )
    for (const candidate of remaining) {
        if (chips.length >= MAX_SUGGESTED_CHIPS) break
        chips.push(candidate)
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
    // `datasetProducers` facet. Adding one (via a suggested chip below the
    // search box) narrows the result list to that producer; removing it
    // widens the list back out. The source column itself stays plain,
    // non-interactive text — producers are only added via suggested chips.
    const [producerFilters, setProducerFilters] = useState<string[]>([])
    const addProducerFilter = (producer: string) =>
        setProducerFilters((prev) =>
            prev.includes(producer) ? prev : [...prev, producer]
        )
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
        queryFn: () => queryAllCharts(liteSearchClient, baseSearchState),
        enabled: Boolean(topicName),
    })

    const autoSuggestedChips = useMemo(
        () => computeAutoSuggestedChips(baseHits ?? [], regionNames),
        [baseHits, regionNames]
    )

    // Editorially curated suggestions (set on the gdoc block) take precedence
    // when present, preserving the pre-existing authoring workflow; a curated
    // chip re-runs its text through the search box, exactly as before.
    // Otherwise, fall back to the auto-generated country/producer chips: a
    // country chip populates the search query (reusing the same country
    // detection that powers manual typing), while a producer chip applies the
    // structured `datasetProducers` filter that the active-filter pills
    // already use. Chips that are already active are hidden rather than
    // shown a second time.
    const suggestedChips: SuggestedChip[] = useMemo(() => {
        if (suggested.length > 0) {
            return suggested.map((text) => ({
                key: `query:${text}`,
                label: text,
                onClick: () => setQuery(text),
            }))
        }
        return autoSuggestedChips
            .filter((chip) =>
                chip.dimension === "producer"
                    ? !producerFilters.includes(chip.name)
                    : !detectedCountries.includes(chip.name)
            )
            .map((chip) => ({
                key: `${chip.dimension}:${chip.name}`,
                label: chip.name,
                onClick: () =>
                    chip.dimension === "producer"
                        ? addProducerFilter(chip.name)
                        : setQuery(chip.name),
            }))
    }, [suggested, autoSuggestedChips, producerFilters, detectedCountries])

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
                            Suggested:
                        </span>
                        {suggestedChips.map((chip) => (
                            <button
                                key={chip.key}
                                type="button"
                                className="all-charts-block__chip"
                                onClick={chip.onClick}
                            >
                                {chip.label}
                            </button>
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
                        onSelect={setSelectedIndex}
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
    onSelect,
    detectedCountries,
}: {
    hits: SearchChartHit[]
    selectedIndex: number
    onSelect: (index: number) => void
    detectedCountries: string[]
}) => {
    return (
        <ul className="all-charts-block__table" role="list">
            {hits.map((hit, index) => (
                <AllChartsTableRow
                    key={hit.objectID}
                    hit={hit}
                    isSelected={index === selectedIndex}
                    onSelect={() => onSelect(index)}
                    detectedCountries={detectedCountries}
                />
            ))}
        </ul>
    )
}

const AllChartsTableRow = ({
    hit,
    isSelected,
    onSelect,
    detectedCountries,
}: {
    hit: SearchChartHit
    isSelected: boolean
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
            <button
                type="button"
                className="all-charts-block__row-button"
                aria-pressed={isSelected}
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
