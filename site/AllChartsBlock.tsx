import {
    useMemo,
    useRef,
    useState,
    useEffect,
    useCallback,
    Fragment,
} from "react"
import { useQuery, keepPreviousData } from "@tanstack/react-query"
import cx from "clsx"
import { reaction } from "mobx"
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
import { Button, GrapherTabIcon } from "@ourworldindata/components"
import {
    GRAPHER_THUMBNAIL_HEIGHT,
    GRAPHER_THUMBNAIL_WIDTH,
    GrapherState,
    GuidedChartContext,
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
    getChartHitDisplayText,
    getDuplicatedChartTitles,
    getChartHitVariantName,
    removeMatchedWordsWithStopWords,
    splitIntoWords,
    sortHitsByBaselineOrder,
    getChartHitIdentity,
    resolveSelectedChartIndex,
    getFilterIcon,
    getFilterAriaLabel,
    capSuggestedSearches,
    SEARCH_BASE_PATH,
} from "./search/searchUtils.js"
import { stateToSearchParams } from "./search/searchState.js"
import { buildSynonymMap } from "./search/synonymUtils.js"
import { SearchDataResultsSkeleton } from "./search/SearchDataResultsSkeleton.js"
import { SearchFilterPill } from "./search/SearchFilterPill.js"
import { useVisibleChartHits } from "./useVisibleChartHits.js"
import { PreviewVariant } from "./search/SearchChartHitRichDataTypes.js"
import { MEDIUM_BREAKPOINT_MEDIA_QUERY } from "./SiteConstants.js"
import { TOPIC_VOCABULARY_URL } from "../settings/clientSettings.mjs"

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
    // Either list is capped at ALL_CHARTS_MAX_SUGGESTED_SEARCHES.
    const suggestedChips: SuggestedChip[] = useMemo(() => {
        const labels =
            suggested.length > 0
                ? suggested
                : vocabularyChips.filter(
                      (keyword) =>
                          query.trim().toLowerCase() !== keyword.toLowerCase()
                  )
        // Capped after that choice, so the line is the same length whichever
        // source filled it, and after the already-typed term is dropped, so
        // hiding one doesn't shorten the line to four. See
        // capSuggestedSearches.
        return capSuggestedSearches(labels).map((label) => ({
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
        // oxlint-disable-next-line react/set-state-in-effect -- the nav is a DOM node outside this tree, so it can only be found after mount
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
                {/* Full width, across both panes rather than boxed into the
                    list pane's column (Marwa's mockup, 2026-09-30): the search
                    filters the whole block, not just the list, and at the
                    list pane's width the placeholder was being clipped. */}
                <AllChartsSearchInput
                    query={query}
                    onQueryChange={setQuery}
                    producerFilters={producerFilters}
                    onRemoveProducerFilter={removeProducerFilter}
                />
            </div>
            {/* Between the sticky header and the panes, not inside the list
                pane: full width like the search bar it belongs to, and —
                because it no longer sits on top of the list — the first row
                and the chart sidecar start at the same height, which is how
                the mockup has them. */}
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
            <div className="all-charts-block__panes">
                <AllChartsLeftPane
                    query={query}
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

    // Which view of the selected chart the sidecar should open on, when it was
    // picked from a row's chart-type links; `undefined` is the chart's own
    // default view, which is where selecting a row by its text or thumbnail
    // goes back to.
    const [selectedTab, setSelectedTab] = useState<GrapherTabName | undefined>(
        undefined
    )

    // The view the selected row's own thumbnail is showing, which is where the
    // sidecar belongs whenever nothing has asked for another one.
    const selectedRowThumbnailTab = useMemo(() => {
        const hit = hits[selectedIndex]
        if (!hit) return undefined
        return getRowThumbnailTab(
            hit,
            pickEntitiesForChartHit(hit, detectedCountries)
        )
    }, [hits, selectedIndex, detectedCountries])

    // Before anything has been clicked, the sidecar should still open on the
    // view the first row's thumbnail is showing, so the outline is right on
    // load rather than only after the first click.
    //
    // A `selectedTab` of the map is overridden rather than kept, and only it:
    // the map is never offered by the chart-type links, so the only way to
    // have asked for it is a row click, i.e. a snapshot of a thumbnail that
    // was showing the map at the time. Once a country filter takes that row
    // off the map (see getRowThumbnailTab) the snapshot is stale, and leaving
    // the sidecar on a world map beside a row that has flipped to Italy would
    // also drop the outline off the thumbnail and highlight no link at all.
    const effectiveSelectedTab =
        selectedTab === undefined ||
        (selectedTab === GRAPHER_TAB_NAMES.WorldMap &&
            selectedRowThumbnailTab !== GRAPHER_TAB_NAMES.WorldMap)
            ? selectedRowThumbnailTab
            : selectedTab

    // The view the chart on the right is *actually* showing, which is what the
    // row's chart-type links highlight. Not the same thing as `selectedTab`:
    // that is only what a link click asked for, and it is `undefined` both
    // before anything has been clicked and after a row is selected by its
    // text, while the chart beside it is plainly showing one of the views the
    // links offer. It also goes stale the moment the visitor uses Grapher's own
    // tab bar. Only the live Grapher knows the answer, so it reports it — see
    // AllChartsSidecar. `undefined` means the chart is on a view the row
    // doesn't list (the table, or the map) or hasn't loaded yet; either way no
    // link is highlighted.
    const [activeTab, setActiveTab] = useState<GrapherTabName | undefined>(
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
        // oxlint-disable-next-line react/set-state-in-effect -- an initial value can't do this; see the note above
        setExpandedIndex(isAccordionLayout ? 0 : null)
        // oxlint-disable-next-line react/exhaustive-effect-dependencies -- `resultKey` is the trigger, not a value the effect reads: a new result set re-opens row 0
    }, [resultKey, isAccordionLayout])

    // Only the rows on screen: a topic's chart list is unbounded, so the block
    // renders it 15 rows at a time, always far enough to include the selected
    // row (see getChartRowWindow).
    const { visibleHits, nextBatchSize, showMore } = useVisibleChartHits(
        hits,
        query,
        selectedIndex
    )

    // Selecting a row — by its text or by its thumbnail, which share one click
    // target — opens the sidecar on the view the thumbnail is showing, so the
    // chart that appears is the one the row just pictured, and the outline on
    // the thumbnail is right. Not the chart's own default: the Algolia record
    // doesn't say what that is (see getRowThumbnailTab).
    const handleRowClick = (index: number) => {
        const hit = hits[index]
        if (hit) setSelectedIdentity(getChartHitIdentity(hit))
        setSelectedTab(
            hit
                ? getRowThumbnailTab(
                      hit,
                      pickEntitiesForChartHit(hit, detectedCountries)
                  )
                : undefined
        )
        setExpandedIndex((prev) => (prev === index ? null : index))
    }

    // A chart-type link selects its row like the row's text does, and
    // additionally sets the view. It never collapses the row it belongs to: on
    // the accordion layout the chart it just picked a view for is the one
    // inside that row.
    const handleChartTypeClick = (index: number, tab: GrapherTabName) => {
        const hit = hits[index]
        if (hit) setSelectedIdentity(getChartHitIdentity(hit))
        setSelectedTab(tab)
        if (isAccordionLayout) setExpandedIndex(index)
    }

    const selectedHit = hits[selectedIndex]

    return (
        <>
            <div className="all-charts-block__left">
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
                            selectedTab={effectiveSelectedTab}
                            activeTab={activeTab}
                            onActiveTabChange={setActiveTab}
                            onRowClick={handleRowClick}
                            onChartTypeClick={handleChartTypeClick}
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
                        {/* The next batch of the list, one click away:
                            "Show 15 more", or the real remainder when fewer
                            are left ("Show 7 more"), and nothing once the list
                            is complete. Revealing only grows the list until the
                            query changes: collapsing a list the visitor has
                            scrolled into would pull the page up from under
                            them. */}
                        {nextBatchSize > 0 && (
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
                                    text={`Show ${nextBatchSize} more`}
                                    ariaLabel={`Show ${nextBatchSize} more indicators on ${topicName}`}
                                    dataTrackNote="all-charts-show-more"
                                    icon={faChevronDown}
                                    iconPosition="right"
                                    onClick={showMore}
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
                        tab={effectiveSelectedTab}
                        onActiveTabChange={setActiveTab}
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
    activeTab,
    onRowClick,
    onActiveTabChange,
    onChartTypeClick,
    detectedCountries,
    searchPhrase,
    duplicatedTitles,
    isRefreshing,
}: {
    // Only the rows on screen — the first 15 of the result set, plus each batch
    // of 15 the visitor has revealed since (see useVisibleChartHits).
    hits: readonly SearchChartHit[]
    selectedIndex: number
    expandedIndex: number | null
    selectedTab?: GrapherTabName
    activeTab?: GrapherTabName
    onRowClick: (index: number) => void
    onActiveTabChange: (tab?: GrapherTabName) => void
    onChartTypeClick: (index: number, tab: GrapherTabName) => void
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
                    activeTab={activeTab}
                    onActiveTabChange={onActiveTabChange}
                    onSelect={() => onRowClick(index)}
                    onSelectChartType={(tab) => onChartTypeClick(index, tab)}
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
 * "" when it doesn't. `tab` is the view picked from the row's chart-type links,
 * if any; without one the chart opens on its own default view.
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

/**
 * The row's own views, in the order Grapher's own tab bar lists them: the one
 * its thumbnail shows, and then the rest.
 *
 * That order comes free. The Algolia record's `availableTabs` is Grapher's
 * `availableTabs` verbatim (see getChartsRecords in
 * baker/algolia/utils/charts.ts), which is built as table, then map, then the
 * chart types — the tab bar's order. So this is that list with the table
 * dropped, and nothing here re-sorts it.
 *
 * The table is dropped because it is not a view of the chart anyone picks from
 * a row: the thumbnail renderer has no table to draw, and it is reachable from
 * the sidecar's own tab bar anyway.
 */
function getRowViews(hit: SearchChartHit): GrapherTabName[] {
    // Belt and braces against a record that lists a tab twice, which would
    // otherwise show the same view in two places.
    return [
        ...new Set(
            (hit.availableTabs ?? []).filter(
                (tab) => tab !== GRAPHER_TAB_NAMES.Table
            )
        ),
    ]
}

/**
 * Views that say nothing useful about one country, so a country-filtered row
 * doesn't flip to them.
 *
 * Only the Marimekko. It plots every entity whatever the filter says and marks
 * the selected one by colour alone, which at the row's 170px comes back as a
 * single hairline bar among a hundred pale ones — and, where the country has
 * no data in that chart, as no mark at all, i.e. a thumbnail the filter
 * visibly didn't change. Checked against the rendered image for the
 * Multidimensional Poverty Index row, whose only chart type this is (Marwa,
 * 2026-10-01).
 */
const TABS_UNREADABLE_FOR_ONE_COUNTRY: readonly GrapherTabName[] = [
    GRAPHER_TAB_NAMES.Marimekko,
]

/**
 * The view a row's thumbnail is rendered on: the map where the chart has one,
 * otherwise its first chart type. Which is just the first of the row's views,
 * since `availableTabs` already puts the map ahead of the chart types.
 *
 * Except while a country filter is in effect on this row, when the map is the
 * one view that can't answer the question just asked: it shows every country
 * whatever the filter says, so the row would sit next to a world map while
 * reading "Italy". Such a row drops to its first chart type instead, which the
 * thumbnail then renders for that country (Marwa, 2026-10-01).
 *
 * The filter is taken per row rather than from the query, as `shownEntities` —
 * the entities the search turned up *on this chart*. A country the chart has
 * no data for is no filter at all: nothing is passed to the thumbnail, so
 * flipping away from the map would only swap a legible world map for an
 * unfiltered chart type. Two cases keep the map for the same reason: a chart
 * with a map and no other view, and one whose only other view says nothing
 * about a single country (see TABS_UNREADABLE_FOR_ONE_COUNTRY).
 *
 * The thumbnail asks for this view *explicitly* rather than letting the chart
 * open on its own default, because the Algolia record doesn't say what that
 * default is — it lists a chart's tabs and nothing more (see ChartRecord in
 * packages/@ourworldindata/types). Naming the view is what lets the row know
 * what its own thumbnail is showing, which is what the list below it excludes
 * and what the outline on it tracks.
 *
 * `undefined` for a record with no view but the table, which shouldn't happen
 * but shouldn't crash the row either.
 */
// oxlint-disable-next-line react/only-export-components -- exported for AllChartsBlock.test.ts; the rule is about fast refresh, and this is a pure helper
export function getRowThumbnailTab(
    hit: SearchChartHit,
    // The entities the search turned up for this chart (see
    // pickEntitiesForChartHit). Empty means no country filter reaches this
    // row, which is the block's resting state.
    shownEntities: readonly string[] = []
): GrapherTabName | undefined {
    const views = getRowViews(hit)
    if (views[0] !== GRAPHER_TAB_NAMES.WorldMap || shownEntities.length === 0)
        return views[0]
    return (
        views
            .slice(1)
            .find((tab) => !TABS_UNREADABLE_FOR_ONE_COUNTRY.includes(tab)) ??
        views[0]
    )
}

/**
 * The chart types a row lists under its source line: every view it has except
 * the one its thumbnail is already showing.
 *
 * Excluding the thumbnail's view is the point. A row whose thumbnail is the
 * line chart and which also offers a "Line" link shows the same view twice and
 * reads as a bug (Marwa, 2026-10-01). So the thumbnail is the first view and
 * these are the alternatives to it — which is also why a chart whose only view
 * is one chart type lists nothing at all: its thumbnail is that view, and
 * there is nothing left to offer.
 *
 * Against Marwa's mockup of 2026-09-30, where the thumbnail is the map on
 * every chart that has one: "Share of population living in extreme poverty"
 * lists Line, Bar, Marimekko; "Multidimensional Poverty Index (MPI)" lists
 * just Marimekko; "Total population living in extreme poverty by world
 * region", a stacked area chart with no map, lists nothing; and "Share in
 * poverty relative to different poverty lines", a line chart with a bar view
 * and no map, lists Bar alone rather than the Line and Bar it used to.
 *
 * Search "italy" and the first of those rows lists Bar and Marimekko instead:
 * its thumbnail has flipped off the map onto the line chart, so the line
 * chart is what there is no longer any point offering.
 */
// oxlint-disable-next-line react/only-export-components -- exported for AllChartsBlock.test.ts; the rule is about fast refresh, and this is a pure helper
export function getRowChartTypeTabs(
    hit: SearchChartHit,
    shownEntities: readonly string[] = []
): GrapherTabName[] {
    const thumbnailTab = getRowThumbnailTab(hit, shownEntities)
    // The map is never one of these links, whichever view the thumbnail ends
    // up on: it is either what the thumbnail is already showing, or the view
    // the country filter just ruled out. A reader who wants it has Grapher's
    // own tab bar in the chart beside the list.
    return getRowViews(hit).filter(
        (tab) => tab !== GRAPHER_TAB_NAMES.WorldMap && tab !== thumbnailTab
    )
}

/**
 * The row's other views, as a line of small text links under its source line —
 * Grapher's own tab icon and label for each, so they read as the same set of
 * views as the tab bar in the chart beside the list. Text links rather than
 * extra thumbnails, deliberately: one thumbnail per row, and the alternatives
 * named rather than pictured (Marwa, 2026-09-30).
 */
const AllChartsRowChartTypes = ({
    hit,
    shownEntities,
    activeTab,
    isSelected,
    onSelectChartType,
}: {
    hit: SearchChartHit
    // The entities the search turned up for this chart, because which views
    // are listed depends on which one the thumbnail took — see
    // getRowThumbnailTab.
    shownEntities: readonly string[]
    // The view the chart beside the list is showing, reported by that chart
    // rather than inferred from the last link clicked — so the highlight is
    // right on first load and after a tab change made inside Grapher, not just
    // after a click here.
    activeTab?: GrapherTabName
    isSelected: boolean
    onSelectChartType: (tab: GrapherTabName) => void
}) => {
    const tabs = useMemo(
        () => getRowChartTypeTabs(hit, shownEntities),
        [hit, shownEntities]
    )

    if (tabs.length === 0) return null

    return (
        <span className="all-charts-block__row-types">
            {tabs.map((tab) => (
                <button
                    key={tab}
                    type="button"
                    className={cx("all-charts-block__row-type", {
                        "all-charts-block__row-type--active":
                            isSelected && activeTab === tab,
                    })}
                    aria-pressed={isSelected && activeTab === tab}
                    aria-label={`${makeLabelForGrapherTab(tab, {
                        format: "long",
                    })}: ${getChartHitDisplayText(hit.title)}`}
                    // These sit inside the row's own click target, which
                    // selects the row and toggles its accordion — so both
                    // handlers stop the event here. Without that a click would
                    // set the view and then immediately have the row's handler
                    // clear it again, and on the accordion layout the same tap
                    // would collapse the chart it just picked a view for.
                    onClick={(event) => {
                        event.stopPropagation()
                        onSelectChartType(tab)
                    }}
                    onKeyDown={(event) => event.stopPropagation()}
                >
                    <GrapherTabIcon tab={tab} />
                    <span className="all-charts-block__row-type-label">
                        {makeLabelForGrapherTab(tab)}
                    </span>
                </button>
            ))}
        </span>
    )
}

/**
 * A row's text with the words the search matched in bold. The segments come from
 * the same normalisation the row filter uses, so the bold words are exactly the
 * ones that kept this row in the list (see splitTextByQueryWordMatches), over the
 * same stripped text the filter compared against (see getChartHitDisplayText).
 */
const HighlightedQueryText = ({
    text,
    searchPhrase,
}: {
    text: string
    searchPhrase: string
}) => {
    const segments = useMemo(
        // Stripped before the words are matched, not after: the segments are
        // what gets rendered, so the markup has to be gone by the time the
        // offsets are measured. See getChartHitDisplayText.
        () =>
            splitTextByQueryWordMatches(
                getChartHitDisplayText(text),
                searchPhrase
            ),
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
    activeTab,
    onSelect,
    onActiveTabChange,
    onSelectChartType,
    detectedCountries,
    searchPhrase,
    duplicatedTitles,
}: {
    hit: SearchChartHit
    isSelected: boolean
    isExpanded: boolean
    selectedTab?: GrapherTabName
    activeTab?: GrapherTabName
    onSelect: () => void
    onActiveTabChange: (tab?: GrapherTabName) => void
    onSelectChartType: (tab: GrapherTabName) => void
    detectedCountries: string[]
    searchPhrase: string
    duplicatedTitles: ReadonlySet<string>
}) => {
    // Entities from the query that are actually available on this chart.
    const shownEntities = useMemo(
        () => pickEntitiesForChartHit(hit, detectedCountries),
        [hit, detectedCountries]
    )

    // The view the thumbnail is rendered on, which is also the view the row
    // selects by default and the one the chart-type links leave out. Depends
    // on the entities above it: a country filter takes a row off the map.
    const thumbnailTab = getRowThumbnailTab(hit, shownEntities)

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
                {/* The row's thumbnail and text stack together form a
                    single click/keyboard target for selecting the row on
                    desktop or expanding/collapsing its mobile accordion. */}
                <div
                    className="all-charts-block__row-main"
                    role="button"
                    tabIndex={0}
                    aria-pressed={isSelected}
                    aria-expanded={isExpanded}
                    onClick={onSelect}
                    onKeyDown={handleRowKeyDown}
                >
                    {/* A static preview of the chart's own default view — no
                        `tab` param, the same view the chart beside the list
                        opens on. Leads the row, with the title and source
                        beside it (Marwa, 2026-09-03). Part of the row's click
                        target rather than a control of its own: clicking it
                        selects the row, like clicking the row's text. Same
                        thumbnail endpoint the search results' previews use.
                        `alt=""` keeps it out of the accessibility tree, so
                        leading the row visually doesn't put anything ahead of
                        the title for a screen reader. */}
                    <img
                        className={cx("all-charts-block__row-thumbnail", {
                            // Outlined when the chart beside the list is on
                            // the view this thumbnail shows, so the thumbnail
                            // reads as the selected one among the row's views
                            // (Marwa, 2026-10-01). Driven by the sidecar's
                            // live activeTab, like the links below it.
                            "all-charts-block__row-thumbnail--active":
                                isSelected && activeTab === thumbnailTab,
                        })}
                        src={constructPreviewUrl({
                            hit,
                            // The view is named rather than left to the
                            // chart's own default, which the Algolia record
                            // doesn't carry — see getRowThumbnailTab. The
                            // entities are the ones the search turned up for
                            // this chart, the same list the row's chip and the
                            // sidecar use, so a country search re-renders the
                            // thumbnail for that country instead of leaving a
                            // world view beside a filtered row (Marwa,
                            // 2026-10-01). Which is also why the view above
                            // moves off the map for such a row: a map shows
                            // every country whatever the entities say.
                            grapherParams: toGrapherQueryParams({
                                entities: shownEntities,
                                tab: thumbnailTab,
                            }),
                            variant: PreviewVariant.Thumbnail,
                            // No labelling at all, so the chart itself gets
                            // the whole frame: at 170px every label in one of
                            // these is illegible anyway, and the row's title
                            // and source line beside it already say what it is
                            // (Marwa, 2026-09-30).
                            //
                            // Both flags, not just the second: imMinimal is
                            // what takes a map's legend and "No data" key
                            // away, and a map has no axes or series labels for
                            // imBare to act on. imBare covers the rest —
                            // series and entity names, value labels, axis
                            // lines and tick labels — and hands the space back
                            // to the plot. See useMinimalLabeling and
                            // useBareLabeling in
                            // packages/@ourworldindata/grapher.
                            isMinimal: true,
                            isBare: true,
                        })}
                        alt=""
                        loading="lazy"
                        // The thumbnail's own dimensions, so the browser can
                        // reserve the right box before the image lands — a
                        // topic page can hold nearly 200 rows of these.
                        width={GRAPHER_THUMBNAIL_WIDTH}
                        height={GRAPHER_THUMBNAIL_HEIGHT}
                    />
                    <span className="all-charts-block__row-text">
                        <span className="all-charts-block__row-title">
                            <HighlightedQueryText
                                text={hit.title}
                                searchPhrase={searchPhrase}
                            />
                        </span>
                        {/* On its own line under the title rather than
                            appended to it (Marwa's mockup, 2026-09-30:
                            "Multidimensional Poverty Index (MPI)" over
                            "Current estimates"). Which rows get one, and how
                            it looks, are unchanged — it is still only the
                            rows whose title collides with another on the
                            topic, still styled as the "Source:" line below
                            it. */}
                        {variantName && (
                            <span className="all-charts-block__row-variant">
                                {variantName}
                            </span>
                        )}
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
                        <AllChartsRowChartTypes
                            hit={hit}
                            shownEntities={shownEntities}
                            activeTab={activeTab}
                            isSelected={isSelected}
                            onSelectChartType={onSelectChartType}
                        />
                        {shownEntities.length > 0 && (
                            <span className="all-charts-block__row-tag">
                                {shownEntities.join(", ")}
                            </span>
                        )}
                    </span>
                </div>
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
                        tab={selectedTab}
                        onActiveTabChange={onActiveTabChange}
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
    onActiveTabChange,
}: {
    hit: SearchChartHit
    detectedCountries: string[]
    /** The view picked from a row's chart-type links, if any. */
    tab?: GrapherTabName
    /**
     * Called with the view this chart is showing, whenever it changes — on
     * load with the view the chart chose for itself, and again every time the
     * visitor uses Grapher's own tab bar. The row's chart-type links highlight
     * it.
     */
    onActiveTabChange?: (tab?: GrapherTabName) => void
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

    // Which view this chart is on is something only the chart knows: the
    // Algolia record lists a chart's tabs but not which one it opens on, and
    // the visitor can switch tabs inside Grapher without touching a link here.
    // Grapher hands its state to whoever provides a GuidedChartContext (see
    // useMaybeGlobalGrapherStateRef), which is how the guided-chart blocks
    // drive a chart from the prose around it — the same door serves here, in
    // the other direction: we only read `activeTab` off it, and change nothing.
    const registerGrapherState = useCallback(
        (grapherState: GrapherState) => {
            if (!onActiveTabChange) return () => undefined
            const dispose = reaction(
                // Not until the config has landed: before that the state is
                // still on its constructed default, and reporting that would
                // highlight a guessed view for as long as the chart takes to
                // load — often the wrong one, since a map chart's default is
                // not the map.
                () =>
                    grapherState.isConfigReady
                        ? grapherState.activeTab
                        : undefined,
                (activeTab) => onActiveTabChange(activeTab),
                { fireImmediately: true }
            )
            return () => {
                dispose()
                // The chart is going away — usually because another one is
                // taking its place, and the new one's view is not this one's.
                onActiveTabChange(undefined)
            }
        },
        [onActiveTabChange]
    )
    const guidedChartContextValue = useMemo(
        () => ({ registerGrapherState }),
        [registerGrapherState]
    )

    return (
        <GuidedChartContext.Provider value={guidedChartContextValue}>
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
        </GuidedChartContext.Provider>
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
