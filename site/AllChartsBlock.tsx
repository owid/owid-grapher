import { useMemo, useRef, useState, useEffect, Fragment } from "react"
import { useQuery, keepPreviousData } from "@tanstack/react-query"
import cx from "clsx"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import {
    faChevronDown,
    faMagnifyingGlass,
    faTimesCircle,
} from "@fortawesome/free-solid-svg-icons"
import { useDebounceValue, useMediaQuery, useResizeObserver } from "usehooks-ts"
import {
    SearchResultType,
    SearchChartHit,
    FilterType,
    ALL_CHARTS_ID,
    GRAPHER_TAB_NAMES,
    GrapherTabName,
} from "@ourworldindata/types"
import { listedRegionsNames } from "@ourworldindata/utils"
import { Button } from "@ourworldindata/components"
import {
    GRAPHER_THUMBNAIL_HEIGHT,
    GRAPHER_THUMBNAIL_WIDTH,
    makeLabelForGrapherTab,
    mapGrapherTabNameToQueryParam,
} from "@ourworldindata/grapher"
import { GrapherWithFallback } from "./GrapherWithFallback.js"
import { useDocumentContext } from "./gdocs/DocumentContext.js"
import {
    fetchTopicVocabulary,
    suggestedKeywords,
    topicVocabularyQueryKey,
} from "./search/topicVocabulary.js"
import { getDirectLiteSearchClient } from "./search/searchClients.js"
import { queryAllCharts, searchQueryKeys } from "./search/queries.js"
import {
    createTopicFilter,
    createCountryFilter,
    createDatasetProducerFilter,
    constructConfigUrl,
    constructPreviewUrl,
    toGrapherQueryParams,
    getEntityQueryStr,
    extractFiltersFromQuery,
    pickEntitiesForChartHit,
    filterChartHitsByQueryWords,
    splitTextByQueryWordMatches,
    getDuplicatedChartTitles,
    getChartHitVariantName,
    removeMatchedWordsWithStopWords,
    splitIntoWords,
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
import { useVisibleChartHits } from "./useVisibleChartHits.js"
import { PreviewVariant } from "./search/SearchChartHitRichDataTypes.js"
import { MEDIUM_BREAKPOINT_MEDIA_QUERY } from "./SiteConstants.js"
import { TOPIC_VOCABULARY_URL } from "../settings/clientSettings.js"

const SEARCH_DEBOUNCE_MS = 200

// The viewport below which the block drops its second pane: the persistent chart
// sidecar is replaced by a per-row accordion, and neither the heading nor the
// search bar sticks. Mirrors the `md-down` breakpoint the stylesheet uses for the
// same switch (see AllChartsBlock.scss).
const ACCORDION_LAYOUT_MEDIA_QUERY = MEDIUM_BREAKPOINT_MEDIA_QUERY

const SEARCH_PLACEHOLDER =
    "Search indicators by name, keyword, country, or source…"

export type SuggestedChip = {
    key: string
    label: string
    onClick: () => void
}

export type AllChartsBlockProps = {
    topicName: string
    // Editorially curated search-suggestion chips (from the gdoc block).
    // Optional — when omitted, chips come from the topic's OWID vocabulary
    // terms instead (see `suggestedKeywords`).
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
    // Deliberately the direct client rather than the shared, proxy-backed one:
    // this block compares two result sets against each other — the typed one it
    // renders and the unfiltered one it pins that list's order to — and only
    // empty-query searches go through the caching proxy, which on a branch
    // preview answers out of a different Algolia application than the typed
    // searches reach. See getDirectLiteSearchClient.
    const liteSearchClient = getDirectLiteSearchClient()

    const [query, setQuery] = useState("")
    const [debouncedQuery] = useDebounceValue(query, SEARCH_DEBOUNCE_MS)

    // Active producer ("source") filters, mirroring the global search's
    // `datasetProducers` facet as a removable pill below the search input.
    // Nothing in this block currently adds to this list — suggested chips
    // populate the search input instead of applying a structured filter, and
    // no longer offer producers at all — but the state and its removal handler
    // stay in place in case a future manually-applied filter UI needs them.
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
    //
    // Whatever is left of the query once those country words are taken out is
    // the phrase the rows themselves are matched against (see `hits` below).
    // Splitting it this way is what keeps a country search working: typing
    // "china" filters by the entity facet, and the leftover phrase is empty, so
    // no row is asked to have the word "china" printed on it. "china emissions"
    // applies the facet *and* requires "emissions" on the row.
    // `removeMatchedWordsWithStopWords` is the same helper the search bar uses
    // when it turns typed words into a filter pill, so "poverty in china" leaves
    // "poverty" rather than a dangling "poverty in".
    const { detectedCountries, searchPhrase } = useMemo(() => {
        if (!debouncedQuery.trim())
            return { detectedCountries: [], searchPhrase: "" }
        const filters = extractFiltersFromQuery(
            debouncedQuery,
            regionNames,
            [], // do not detect topics — the topic is fixed
            [],
            { threshold: 1, limit: 1 }, // exact matches only
            synonymMap
        )
        const countryFilters = filters.filter(
            (f) => f.type === FilterType.COUNTRY
        )
        return {
            detectedCountries: countryFilters.map((f) => f.name),
            searchPhrase: removeMatchedWordsWithStopWords(
                splitIntoWords(debouncedQuery),
                countryFilters.flatMap((f) => f.positions)
            ),
        }
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

    // A second, stable "topic only" query (no text/country/producer filters).
    // It fixes the order the rows are listed in, whatever the visitor has typed
    // — see sortHitsByBaselineOrder below. When no filters are active yet (the
    // common initial state), this shares its cache entry — and network request
    // — with the query above.
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
        // Every attribute this needs is part of the shared
        // DATA_CATALOG_ATTRIBUTES, so nothing extra is requested here
        // (contrast the old tag-based chips, which needed `tags`).
        queryFn: () => queryAllCharts(liteSearchClient, baseSearchState),
        enabled: Boolean(topicName),
        placeholderData: keepPreviousData,
    })

    // The vocabulary is a single file shared by every topic, fetched rather than
    // bundled so that regenerating it is an upload rather than a deploy (and so
    // a staging server can be pointed at its own copy). One request per page
    // load at most: react-query dedupes it across blocks, and the CDN in front
    // of it caches for 5 minutes.
    const { data: vocabulary } = useQuery({
        queryKey: topicVocabularyQueryKey(TOPIC_VOCABULARY_URL),
        queryFn: fetchTopicVocabulary,
        staleTime: Infinity,
    })

    // Which of the topic's titles more than one chart carries, computed over the
    // *unfiltered* result set so that a row's variant name is a stable property
    // of that row rather than something that appears and disappears as a query
    // narrows the list around it.
    const duplicatedTitles = useMemo(
        () => getDuplicatedChartTitles(baseHits ?? []),
        [baseHits]
    )

    // Shown in the order the vocabulary publishes them — see suggestedKeywords.
    // Independent of the chart list, so the line appears as soon as the
    // vocabulary does rather than waiting for a second request.
    const vocabularyChips = useMemo(
        () => suggestedKeywords(vocabulary?.[topicName]),
        [vocabulary, topicName]
    )

    // Searching must narrow this list without ever re-ordering it.
    //
    // Algolia ranks every result set by relevance to the query text, so each
    // keystroke both narrows the list and re-ranks whatever survives. In this
    // block that reads as the rows jumping around unprompted while you type,
    // so the block's *default* order is pinned instead: rows always appear in
    // the relative order they have in `baseHits`, the unfiltered topic-only
    // result set fetched above (so this needs no extra request). That holds for
    // every query — a country, a keyword, or
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
    //
    // The rows are also narrowed to the ones whose own text contains every word
    // typed, which is a "find" within the topic rather than a relevance search:
    // Algolia requires every word of the query to appear *somewhere* in a
    // record, but each word may come from a different searchable attribute (tags,
    // producers, entity names, the slug) and may be a typo or a synonym away from
    // what was typed, so "national poverty line" came back with 34 charts on the
    // Poverty topic — including "Mean income or consumption per day", which
    // contains none of the three words. See filterChartHitsByQueryWords for the
    // mechanism and for why the narrowing happens here rather than in the query.
    const isBaselinePending = !baseHits && !isBaseError
    const hits = useMemo(() => {
        const rawHits = filterChartHitsByQueryWords(data ?? [], searchPhrase)
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
    }, [data, baseHits, isBaseError, searchPhrase])

    // Editorially curated suggestions (set on the gdoc block) take precedence
    // when present, preserving the pre-existing authoring workflow — including
    // any term an author has deliberately listed there that the vocabulary
    // wouldn't offer, a place name among them. Every chip, curated or from the
    // vocabulary, does exactly one thing when clicked: populate the search
    // input with its label, so it drives the same full-text search path as if
    // the visitor had typed it themselves. A vocabulary chip whose term the
    // visitor has already typed is hidden rather than offered back to them.
    const suggestedChips: SuggestedChip[] = useMemo(() => {
        const labels =
            suggested.length > 0
                ? suggested
                : vocabularyChips.filter(
                      (keyword) =>
                          query.trim().toLowerCase() !== keyword.toLowerCase()
                  )
        return labels.map((label) => ({
            key: `query:${label}`,
            label,
            onClick: () => setQuery(label),
        }))
    }, [suggested, vocabularyChips, query])

    // The heading and the search bar stick to the top of the viewport as a
    // single unit on desktop (see .all-charts-block__sticky-header), which means
    // the chart sidecar beside the list has to come to rest *below* that unit
    // rather than sliding behind it. How tall the unit is depends on the topic's
    // name — long ones wrap the heading onto a second line — so it is measured
    // rather than assumed, and handed to the stylesheet as a custom property.
    // Nothing reads it below the breakpoint, where nothing sticks and the
    // sidecar is hidden.
    //
    // The border box, not the content box: the unit's own 12px of bottom
    // padding is part of the opaque band a row is clipped against, so the
    // sidecar has to come to rest below that too, not 12px up inside it.
    const stickyHeaderRef = useRef<HTMLDivElement>(null)
    const { height: stickyHeaderHeight } = useResizeObserver({
        ref: stickyHeaderRef as React.RefObject<HTMLDivElement>,
        box: "border-box",
    })

    // ...and the unit itself has to come to rest flush against the bottom of
    // whatever is *already* pinned at the top of the viewport, so that nothing
    // is left showing in between. That is the topic page's own sub-nav
    // (.sticky-nav, pinned at top: 0) — but only on the topic pages that have
    // one: it is rendered from the gdoc's `sticky-nav` list, which plenty of
    // pages don't define (see site/gdocs/pages/GdocPost.tsx), and where it is
    // present its height varies by breakpoint (56px, 48px on small viewports).
    // Both facts are only knowable at runtime, so the nav is measured the same
    // way the unit above is, and 0 stands in when there is no nav to measure.
    //
    // This replaced a hardcoded 72px offset, which assumed a sub-nav was always
    // there: on the pages without one it left a live strip at the top of the
    // viewport for rows to scroll through, above a dead band of white.
    const [stickyNavElement, setStickyNavElement] =
        useState<HTMLElement | null>(null)
    useEffect(() => {
        setStickyNavElement(document.querySelector<HTMLElement>(".sticky-nav"))
    }, [])
    // A ref object rather than the element, because that is what the hook takes;
    // a fresh one per element so the hook re-observes when it appears.
    const stickyNavRef = useMemo(
        () => ({ current: stickyNavElement }),
        [stickyNavElement]
    )
    const { height: stickyNavHeight } = useResizeObserver({
        ref: stickyNavRef as React.RefObject<HTMLElement>,
        box: "border-box",
    })

    if (isError || !topicName) return null

    return (
        <section
            className={cx(className, "all-charts-block")}
            id={id}
            style={
                {
                    "--all-charts-block-pinned-above-height": `${stickyNavHeight ?? 0}px`,
                    "--all-charts-block-sticky-header-height": `${stickyHeaderHeight ?? 0}px`,
                } as React.CSSProperties
            }
        >
            <div
                className="all-charts-block__sticky-header"
                ref={stickyHeaderRef}
            >
                <h1 className="h1-semibold all-charts-block__heading">
                    <span>All charts on {topicName}</span>
                    <a
                        className="deep-link"
                        aria-labelledby={id}
                        href={`#${id}`}
                    />
                </h1>
                {/* Laid out on the same two-column grid as the panes below, so
                    the input keeps the width of the list pane it belongs to
                    while the sticky unit's white background spans the whole
                    block. */}
                <div className="all-charts-block__sticky-header-columns">
                    <div className="all-charts-block__sticky-header-search">
                        <AllChartsSearchInput
                            query={query}
                            onQueryChange={setQuery}
                            producerFilters={producerFilters}
                            onRemoveProducerFilter={removeProducerFilter}
                        />
                    </div>
                </div>
            </div>
            <div className="all-charts-block__panes">
                <AllChartsLeftPane
                    query={query}
                    suggestedChips={suggestedChips}
                    hits={hits}
                    // The skeleton also covers the window where the results
                    // are in but the baseline that orders them isn't (see
                    // `hits` above), so the list is never shown in an order
                    // that's about to change.
                    isLoading={isLoading || isBaselinePending}
                    isFetching={isFetching}
                    detectedCountries={detectedCountries}
                    // The typed words, minus any country name (which is
                    // applied as a facet instead) — what the rows were
                    // filtered on, and so what they bold.
                    searchPhrase={searchPhrase}
                    duplicatedTitles={duplicatedTitles}
                    topicName={topicName}
                    searchParams={stateToSearchParams(searchState)}
                />
            </div>
        </section>
    )
}

type AllChartsLeftPaneProps = {
    query: string
    suggestedChips: SuggestedChip[]
    hits: SearchChartHit[]
    isLoading: boolean
    isFetching: boolean
    detectedCountries: string[]
    searchPhrase: string
    duplicatedTitles: ReadonlySet<string>
    topicName: string
    searchParams: URLSearchParams
}

const AllChartsLeftPane = (props: AllChartsLeftPaneProps) => {
    const {
        query,
        suggestedChips,
        hits,
        isLoading,
        isFetching,
        detectedCountries,
        searchPhrase,
        duplicatedTitles,
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
    // `selectedIndex`, which continues to drive the desktop sidecar.
    const [expandedIndex, setExpandedIndex] = useState<number | null>(null)
    const isAccordionLayout = useMediaQuery(ACCORDION_LAYOUT_MEDIA_QUERY)

    // Which view of the selected chart to show, when it was picked from a row's
    // thumbnails; `undefined` is the chart's own default view, which is what
    // selecting a row by its text goes back to.
    const [selectedTab, setSelectedTab] = useState<GrapherTabName | undefined>(
        undefined
    )

    // Where a result set starts out. On the accordion layout the first row opens
    // with its chart showing, so the block never presents a phone with a list of
    // titles and no chart at all — the counterpart of the desktop sidecar, which
    // opens on row 1 for the same reason (see resolveSelectedChartIndex).
    //
    // This is the same effect that used to collapse everything on a new result
    // set, rather than an initial value alongside it: the effect runs when the
    // results first arrive, so an initial value would immediately be overwritten
    // by it. Which also settles what a new query does — it re-opens the first
    // row of the new results, so the chart on screen always belongs to the list
    // under it.
    //
    // Row 0 rather than `selectedIndex`: both are 0 for a fresh result set (no
    // selection has been made yet), and pinning it to the first row keeps the
    // one open chart at the top of the list, where a phone visitor can see it.
    // The row stays a toggle: tapping it closes the chart again, and tapping
    // another row moves it, exactly as before.
    //
    // Off the accordion layout this stays `null` — not just because there is
    // nothing to expand, but because the accordion markup still exists on
    // desktop (hidden by CSS), and mounting a Grapher into a hidden element
    // would render a second copy of the chart already in the sidecar.
    useEffect(() => {
        setExpandedIndex(isAccordionLayout ? 0 : null)
    }, [resultKey, isAccordionLayout])

    // Only the rows on screen: a topic's chart list is unbounded, so the block
    // renders a bounded first slice of it until the visitor asks for the rest.
    const { visibleHits, hasHiddenHits, revealAll } = useVisibleChartHits(
        hits,
        query
    )

    const handleRowClick = (index: number) => {
        const hit = hits[index]
        if (hit) setSelectedIdentity(getChartHitIdentity(hit))
        setSelectedTab(undefined)
        setExpandedIndex((prev) => (prev === index ? null : index))
    }

    // A thumbnail selects its row like the row's text does, and additionally
    // sets the view. It never collapses the row it belongs to: on the accordion
    // layout the chart it just picked a view for is the one inside that row.
    const handleThumbnailClick = (index: number, tab?: GrapherTabName) => {
        const hit = hits[index]
        if (hit) setSelectedIdentity(getChartHitIdentity(hit))
        setSelectedTab(tab)
        if (isAccordionLayout) setExpandedIndex(index)
    }

    const selectedHit = hits[selectedIndex]

    return (
        <>
            <div className="all-charts-block__left">
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
                    <>
                        <AllChartsTable
                            hits={visibleHits}
                            selectedIndex={selectedIndex}
                            expandedIndex={expandedIndex}
                            selectedTab={selectedTab}
                            onRowClick={handleRowClick}
                            onThumbnailClick={handleThumbnailClick}
                            detectedCountries={detectedCountries}
                            searchPhrase={searchPhrase}
                            duplicatedTitles={duplicatedTitles}
                            // True while a new debounced query is fetching in
                            // the background (see the keepPreviousData note
                            // above) — a subtle dim on the still-visible
                            // previous results, rather than the skeleton/blank
                            // state `isLoading` triggers on a genuine first
                            // load.
                            isRefreshing={isFetching && !isLoading}
                        />
                        {/* The rest of the list, one click away. Counts the
                            whole result set for the current query, not the
                            slice on screen, so the number narrows with the
                            search ("Show all 196 indicators" on the bare topic,
                            165 once "china" is typed). Revealing is one-way
                            until the query changes: collapsing a list the
                            visitor has scrolled into would pull the page up
                            from under them. */}
                        {hasHiddenHits && (
                            <div className="all-charts-block__reveal">
                                <Button
                                    // $blue-20 fill with $blue-90 text: the
                                    // same theme the search page's own "Show
                                    // more" control uses (see
                                    // SearchHorizontalDivider). An outline theme
                                    // can't be used here: those declare no
                                    // background, which is invisible on the
                                    // <a> elements they're used on elsewhere
                                    // but leaves a <button> showing the
                                    // browser's default grey.
                                    theme="solid-light-blue"
                                    className="all-charts-block__reveal-button"
                                    text={`Show all ${hits.length} indicators`}
                                    ariaLabel={`Show all ${hits.length} indicators on ${topicName}`}
                                    dataTrackNote="all-charts-reveal-all"
                                    icon={faChevronDown}
                                    iconPosition="right"
                                    onClick={revealAll}
                                />
                            </div>
                        )}
                    </>
                )}
            </div>
            <div className="all-charts-block__right">
                {selectedHit && (
                    <AllChartsSidecar
                        hit={selectedHit}
                        detectedCountries={detectedCountries}
                        tab={selectedTab}
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
    selectedTab,
    onRowClick,
    onThumbnailClick,
    detectedCountries,
    searchPhrase,
    duplicatedTitles,
    isRefreshing,
}: {
    // Only the rows on screen — the first slice of the result set, or all of it
    // once the visitor has revealed the rest (see useVisibleChartHits).
    hits: readonly SearchChartHit[]
    selectedIndex: number
    expandedIndex: number | null
    selectedTab?: GrapherTabName
    onRowClick: (index: number) => void
    onThumbnailClick: (index: number, tab?: GrapherTabName) => void
    detectedCountries: string[]
    searchPhrase: string
    duplicatedTitles: ReadonlySet<string>
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
                    selectedTab={selectedTab}
                    onSelect={() => onRowClick(index)}
                    onSelectTab={(tab) => onThumbnailClick(index, tab)}
                    detectedCountries={detectedCountries}
                    searchPhrase={searchPhrase}
                    duplicatedTitles={duplicatedTitles}
                />
            ))}
        </ul>
    )
}

/**
 * The Grapher view the sidecar is showing for a hit, as a query string — e.g.
 * "?country=~ESP" when the search names a country this chart has data for, and
 * "" when it doesn't. `tab` is the view picked from the row's thumbnails, if
 * any; without one the chart opens on its own default view.
 */
function getSidecarViewQueryStr(
    hit: SearchChartHit,
    detectedCountries: string[],
    tab?: GrapherTabName
): string {
    const entityQueryStr = getEntityQueryStr(
        pickEntitiesForChartHit(hit, detectedCountries)
    )
    if (!tab) return entityQueryStr
    const tabQueryStr = `tab=${mapGrapherTabNameToQueryParam(tab)}`
    return entityQueryStr
        ? `${entityQueryStr}&${tabQueryStr}`
        : `?${tabQueryStr}`
}

// How many of a chart's views a row offers as thumbnails. The rest stay
// reachable through the sidecar's own tab bar.
const MAX_ROW_THUMBNAILS = 3

/**
 * The views a row offers as thumbnails, in priority order: the chart's own
 * default view, then its map, then its remaining chart types. `undefined` is
 * that default view — the Algolia record says which tabs a chart has but not
 * which one it opens on, so it is requested with no `tab` param at all, exactly
 * as the sidecar loads it. A chart whose only view is a map therefore already
 * has that map in the first slot, and is not offered it twice.
 *
 * The table is never offered: the thumbnail renderer has no table to draw and
 * answers a `tab=table` request with the chart instead.
 */
function getRowThumbnailTabs(
    hit: SearchChartHit
): (GrapherTabName | undefined)[] {
    const chartTabs = hit.availableTabs.filter(
        (tab) =>
            tab !== GRAPHER_TAB_NAMES.Table &&
            tab !== GRAPHER_TAB_NAMES.WorldMap
    )
    const hasSeparateMapTab =
        hit.availableTabs.includes(GRAPHER_TAB_NAMES.WorldMap) &&
        chartTabs.length > 0
    return [
        undefined,
        ...(hasSeparateMapTab ? [GRAPHER_TAB_NAMES.WorldMap] : []),
        ...chartTabs.slice(1),
    ].slice(0, MAX_ROW_THUMBNAILS)
}

/**
 * A row's thumbnails: one static preview per view of the chart, from the same
 * thumbnail endpoint the search results' previews use (see constructPreviewUrl).
 * Clicking one selects the row and puts that view in the chart beside it.
 */
const AllChartsRowThumbnails = ({
    hit,
    selectedTab,
    isSelected,
    onSelectTab,
}: {
    hit: SearchChartHit
    selectedTab?: GrapherTabName
    isSelected: boolean
    onSelectTab: (tab?: GrapherTabName) => void
}) => {
    const tabs = useMemo(() => getRowThumbnailTabs(hit), [hit])

    return (
        <div className="all-charts-block__row-thumbnails">
            {tabs.map((tab) => {
                const label = tab
                    ? makeLabelForGrapherTab(tab, { format: "long" })
                    : "Default view"
                return (
                    <button
                        key={tab ?? "default"}
                        type="button"
                        className={cx("all-charts-block__row-thumbnail", {
                            "all-charts-block__row-thumbnail--active":
                                isSelected && selectedTab === tab,
                        })}
                        aria-pressed={isSelected && selectedTab === tab}
                        aria-label={`${label}: ${hit.title}`}
                        onClick={() => onSelectTab(tab)}
                    >
                        <img
                            src={constructPreviewUrl({
                                hit,
                                grapherParams: toGrapherQueryParams({ tab }),
                                variant: PreviewVariant.Thumbnail,
                            })}
                            alt=""
                            loading="lazy"
                            // The thumbnail's own dimensions, so the browser can
                            // reserve the right box before the image lands — a
                            // topic page can hold nearly 200 rows of these.
                            width={GRAPHER_THUMBNAIL_WIDTH}
                            height={GRAPHER_THUMBNAIL_HEIGHT}
                        />
                    </button>
                )
            })}
        </div>
    )
}

/**
 * A row's text with the words the search matched in bold. The segments come from
 * the same normalisation the row filter uses, so the bold words are exactly the
 * ones that kept this row in the list (see splitTextByQueryWordMatches).
 */
const HighlightedQueryText = ({
    text,
    searchPhrase,
}: {
    text: string
    searchPhrase: string
}) => {
    const segments = useMemo(
        () => splitTextByQueryWordMatches(text, searchPhrase),
        [text, searchPhrase]
    )
    return (
        <>
            {segments.map((segment, index) =>
                segment.isMatch ? (
                    <strong key={index}>{segment.text}</strong>
                ) : (
                    <Fragment key={index}>{segment.text}</Fragment>
                )
            )}
        </>
    )
}

const AllChartsTableRow = ({
    hit,
    isSelected,
    isExpanded,
    selectedTab,
    onSelect,
    onSelectTab,
    detectedCountries,
    searchPhrase,
    duplicatedTitles,
}: {
    hit: SearchChartHit
    isSelected: boolean
    isExpanded: boolean
    selectedTab?: GrapherTabName
    onSelect: () => void
    onSelectTab: (tab?: GrapherTabName) => void
    detectedCountries: string[]
    searchPhrase: string
    duplicatedTitles: ReadonlySet<string>
}) => {
    // Entities from the query that are actually available on this chart.
    const shownEntities = pickEntitiesForChartHit(hit, detectedCountries)

    // Rendered as a single "Source: …" line under the title rather than in a
    // column of its own, so the row reads as one block of text instead of a
    // table cell.
    const source = (hit.datasetProducers ?? []).join(", ")

    // Only shown where two charts on the topic share a title, which is the one
    // case a reader needs it to tell the rows apart. See getChartHitVariantName.
    const variantName = getChartHitVariantName(hit, duplicatedTitles)

    // The subtitle is hidden in the block's default view — the list reads as a
    // scannable index of titles — and revealed as soon as the visitor searches,
    // since the row filter matches subtitle text too and a row kept for words
    // that are only in its subtitle would otherwise look like a stray result.
    // A country counts as a search even though it is applied as a facet rather
    // than as a phrase, so it leaves nothing in `searchPhrase` to bold.
    const isSearching =
        searchPhrase.trim() !== "" || detectedCountries.length > 0

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
                    mobile accordion. */}
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
                        <HighlightedQueryText
                            text={hit.title}
                            searchPhrase={searchPhrase}
                        />
                        {variantName && (
                            <span className="all-charts-block__row-variant">
                                {variantName}
                            </span>
                        )}
                    </span>
                    {isSearching && hit.subtitle && (
                        <span className="all-charts-block__row-subtitle">
                            <HighlightedQueryText
                                text={hit.subtitle}
                                searchPhrase={searchPhrase}
                            />
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
                                <HighlightedQueryText
                                    text={source}
                                    searchPhrase={searchPhrase}
                                />
                            </span>
                        </span>
                    )}
                    {shownEntities.length > 0 && (
                        <span className="all-charts-block__row-tag">
                            {shownEntities.join(", ")}
                        </span>
                    )}
                </div>
                {/* A sibling of the text target rather than part of it: these
                    are buttons of their own, and a button inside a
                    role="button" would hand every thumbnail click to the row
                    as well. */}
                <AllChartsRowThumbnails
                    hit={hit}
                    selectedTab={selectedTab}
                    isSelected={isSelected}
                    onSelectTab={onSelectTab}
                />
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
                        tab={isSelected ? selectedTab : undefined}
                    />
                </div>
            )}
        </li>
    )
}

const AllChartsSidecar = ({
    hit,
    detectedCountries,
    tab,
}: {
    hit: SearchChartHit
    detectedCountries: string[]
    tab?: GrapherTabName
}) => {
    const { isPreviewing } = useDocumentContext()

    // The search field's country selection takes precedence over Grapher's own
    // entity selector. A new search resets it (the queryStr changes), but we
    // don't track entity changes made inside Grapher back to the search bar.
    // Shared with the row's "Explore the data" href — see
    // getSidecarViewQueryStr.
    const queryStr = getSidecarViewQueryStr(hit, detectedCountries, tab)

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
