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

// A chart's own topic tags are noisy for suggestions (very common words like
// "Uncategorized" or a topic's parent-area tag) — steer clear of surfacing
// these as if they were interesting secondary groupings.
const TAG_DENYLIST = new Set(["uncategorized"])

type SuggestedChipCandidate = {
    dimension: "country" | "producer" | "tag"
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
 * search" chips from per-chart dimensions Algolia returns to the client (see
 * DATA_CATALOG_ATTRIBUTES + the `tags` field requested specifically for this
 * block, see `queryAllCharts` callers below): the countries/entities a chart
 * has data for (`availableEntities`/`originalAvailableEntities`), its other
 * topic tags (`tags`, excluding the topic this block is already scoped to),
 * and its data producers (`datasetProducers`).
 *
 * To match the design brief's mix of a couple of countries plus topical
 * groupings (e.g. "Spain, Japan, Fertility, Mortality, UN WPP"), country
 * chips are capped at two, remaining slots are filled with the most frequent
 * secondary tags first, and producers are only used to top up the list when
 * there isn't enough tag variety.
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
    const tagCounts = new Map<string, number>()

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

        // Other topical groupings the chart belongs to — excluding the topic
        // this block is already scoped to, since every chart here has it and
        // it wouldn't narrow anything down.
        const tagsOnChart = new Set(
            (hit.tags ?? []).filter(
                (tag) =>
                    tag !== topicName && !TAG_DENYLIST.has(tag.toLowerCase())
            )
        )
        for (const tag of tagsOnChart) {
            tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1)
        }
    }

    const topCountries = rankByFrequency(countryCounts, "country")
    const topProducers = rankByFrequency(producerCounts, "producer")
    const topTags = rankByFrequency(tagCounts, "tag")

    // At most two country chips (both must still clear the frequency
    // threshold applied above), then prefer topical/dataset groupings for
    // the remaining slots, falling back to producers only if there isn't
    // enough tag variety to fill out the list.
    const chips: SuggestedChipCandidate[] = [...topCountries.slice(0, 2)]

    for (const tag of topTags) {
        if (chips.length >= MAX_SUGGESTED_CHIPS) break
        chips.push(tag)
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
        // `tags` isn't part of the shared DATA_CATALOG_ATTRIBUTES (it's not
        // needed by the data catalog or featured metrics, the other
        // consumers of queryCharts/queryAllCharts) — request it explicitly
        // here since computeAutoSuggestedChips uses it for tag-based chips.
        queryFn: () =>
            queryAllCharts(liteSearchClient, baseSearchState, undefined, [
                "tags",
            ]),
        enabled: Boolean(topicName),
    })

    const autoSuggestedChips = useMemo(
        () => computeAutoSuggestedChips(baseHits ?? [], regionNames, topicName),
        [baseHits, regionNames, topicName]
    )

    // Editorially curated suggestions (set on the gdoc block) take precedence
    // when present, preserving the pre-existing authoring workflow; a curated
    // chip re-runs its text through the search box, exactly as before.
    // Otherwise, fall back to the auto-generated country/tag/producer chips:
    // a country or tag chip populates the search query (reusing the same
    // country detection that powers manual typing — tag chips just search
    // for the tag's name as free text), while a producer chip applies the
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
                onClick: () =>
                    chip.dimension === "producer"
                        ? addProducerFilter(chip.name)
                        : setQuery(chip.name),
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
