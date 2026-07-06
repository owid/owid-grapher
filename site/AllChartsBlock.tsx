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

export type AllChartsBlockProps = {
    topicName: string
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
    // `datasetProducers` facet. Removing one widens the result list back out.
    // (There is currently no UI to add one from this block — the source
    // column is plain, non-interactive text.)
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
                    suggested={suggested}
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
    suggested: string[]
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
        suggested,
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
                {suggested.length > 0 && (
                    <div className="all-charts-block__suggested">
                        <span className="all-charts-block__suggested-label">
                            Suggested:
                        </span>
                        {suggested.map((suggestion) => (
                            <button
                                key={suggestion}
                                type="button"
                                className="all-charts-block__chip"
                                onClick={() => onQueryChange(suggestion)}
                            >
                                {suggestion}
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
