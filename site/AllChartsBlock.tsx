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
    EntityName,
} from "@ourworldindata/types"
import { listedRegionsNames } from "@ourworldindata/utils"
import { Button, getPrefersReducedMotion } from "@ourworldindata/components"
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
    ALL_CHARTS_ROW_BATCH_SIZE,
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
// sidecar is replaced by a per-row accordion, the heading stops sticking, and V2
// pages its list instead of scrolling it. Mirrors the `md-down` breakpoint the
// stylesheet uses for the same switch (see AllChartsBlock.scss).
const ACCORDION_LAYOUT_MEDIA_QUERY = MEDIUM_BREAKPOINT_MEDIA_QUERY

const SEARCH_PLACEHOLDER =
    "Search indicators by name, keyword, country, or source…"

// The two ways of containing a topic's chart list, switchable while they are
// being compared on the staging site. Both are the same design in every other
// respect; they differ only in how much of the list is in the page.
//
// - V1 pages it: ALL_CHARTS_ROW_BATCH_SIZE rows, then that many more per click
//   of the "Show 15 more" control under the list (see useVisibleChartHits).
// - V2 renders the complete list, contained in a box as tall as the chart
//   beside it that fades out at the bottom — the treatment the live
//   all-charts block gives its thumbnail list (`.related-charts__thumbnails`
//   in site/blocks/related-charts.scss). See .all-charts-block__list-container.
//   On the accordion layout it pages instead, V2_ACCORDION_ROW_BATCH_SIZE rows
//   at a time: a scroll region inside a phone's page traps the page's own
//   scrolling.
//
// Prototype scaffolding, not a feature: once one of them is chosen, this, the
// switcher, the query parameter and the other version's code all come out.
// The numbers are the ones the versions are referred to by in links that have
// already been shared.
const ALL_CHARTS_VARIANTS = ["v1", "v2"] as const

type AllChartsVariant = (typeof ALL_CHARTS_VARIANTS)[number]

// V1 is what the block looks like with no parameter set, and the parameter is
// dropped again when it is selected — there is no URL that pins the default,
// because the bare URL is the default. A parameter that names no variant lands
// here too (links from before the switch was repurposed name a `v3`, `v4` or
// `v5`) rather than erroring or leaving the block unstyled.
const ALL_CHARTS_DEFAULT_VARIANT: AllChartsVariant = "v1"

// Kept in the URL rather than only in component state so that one specific
// version can be linked to.
const ALL_CHARTS_VARIANT_PARAM = "allChartsVariant"

// What distinguishes each one, for the switcher's options — enough to tell
// them apart in the list without having to try them all.
const ALL_CHARTS_VARIANT_LABELS: Record<AllChartsVariant, string> = {
    v1: "V1 — 15 at a time, show more",
    v2: "V2 — full list, faded (10 at a time on mobile)",
}

// How many rows V2 shows at a time on the accordion layout, where it pages its
// list as V1 does rather than containing it. Fewer than V1's
// ALL_CHARTS_ROW_BATCH_SIZE: on a phone the first row opens with its chart
// inside it, so ten rows are already several screens.
const V2_ACCORDION_ROW_BATCH_SIZE = 10

const isAllChartsVariant = (value: string | null): value is AllChartsVariant =>
    value !== null && ALL_CHARTS_VARIANTS.some((variant) => variant === value)

/**
 * The version currently selected, read from (and written back to) the query
 * string so a link can carry it.
 *
 * The parameter is read after mount rather than during the first render: the
 * page is statically baked, so a first render that already reflected the query
 * string would not match the markup the baker produced.
 */
const useAllChartsVariant = (): [
    AllChartsVariant,
    (variant: AllChartsVariant) => void,
] => {
    const [variant, setVariant] = useState<AllChartsVariant>(
        ALL_CHARTS_DEFAULT_VARIANT
    )

    useEffect(() => {
        const fromUrl = new URLSearchParams(window.location.search).get(
            ALL_CHARTS_VARIANT_PARAM
        )
        // oxlint-disable-next-line react/set-state-in-effect -- the query string is only readable after mount, see above
        if (isAllChartsVariant(fromUrl)) setVariant(fromUrl)
    }, [])

    const selectVariant = useCallback((next: AllChartsVariant) => {
        setVariant(next)
        const url = new URL(window.location.href)
        if (next === ALL_CHARTS_DEFAULT_VARIANT)
            url.searchParams.delete(ALL_CHARTS_VARIANT_PARAM)
        else url.searchParams.set(ALL_CHARTS_VARIANT_PARAM, next)
        // replaceState rather than pushState: flipping between the versions
        // shouldn't leave an entry per flip to walk back through.
        window.history.replaceState(null, "", url)
    }, [])

    return [variant, selectVariant]
}

/**
 * The switcher itself. Sits above the heading rather than inside the sticky
 * unit with it, so that it stays outside the design being compared.
 */
const AllChartsVariantSwitcher = ({
    variant,
    onVariantChange,
    id,
}: {
    variant: AllChartsVariant
    onVariantChange: (variant: AllChartsVariant) => void
    id: string
}) => (
    <div className="all-charts-block__variant-switcher">
        <label htmlFor={id}>Design variant</label>
        <select
            id={id}
            className="all-charts-block__variant-select"
            value={variant}
            onChange={(event) => {
                const next = event.target.value
                if (isAllChartsVariant(next)) onVariantChange(next)
            }}
        >
            {ALL_CHARTS_VARIANTS.map((option) => (
                <option key={option} value={option}>
                    {ALL_CHARTS_VARIANT_LABELS[option]}
                </option>
            ))}
        </select>
    </div>
)

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
    // Nothing reads it below the breakpoint, where the heading doesn't stick
    // and the sidecar is hidden.
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
    // is left showing in between — as does V1's search bar, which pins on its
    // own on the accordion layout. That is the topic page's own sub-nav
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

    // On the accordion layout the search bar is pinned on its own (see
    // .all-charts-block__search), so a row scrolled into view has to stop
    // below it as well as below the nav: its height is published for the rows'
    // scroll-margin-top. The border box, for the same reason as the unit's.
    const searchRef = useRef<HTMLDivElement>(null)
    const { height: searchHeight } = useResizeObserver({
        ref: searchRef as React.RefObject<HTMLDivElement>,
        box: "border-box",
    })

    const [variant, setVariant] = useAllChartsVariant()

    if (isError || !topicName) return null

    return (
        <section
            className={cx(className, "all-charts-block")}
            id={id}
            // Which version is showing. Nothing in the stylesheet tells the
            // two apart at the moment; the attribute identifies the version
            // in the page.
            data-all-charts-variant={variant}
            style={
                {
                    "--all-charts-block-pinned-above-height": `${stickyNavHeight ?? 0}px`,
                    "--all-charts-block-sticky-header-height": `${stickyHeaderHeight ?? 0}px`,
                    "--all-charts-block-search-height": `${searchHeight ?? 0}px`,
                } as React.CSSProperties
            }
        >
            <AllChartsVariantSwitcher
                variant={variant}
                onVariantChange={setVariant}
                id={`${id}-variant`}
            />
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
                {/* Full width, spanning both panes rather than sitting in the
                    first column of the grid below it: the input searches the
                    whole block, not just the list, and the mockup gives it the
                    block's own width (Marwa, 2026-09-30). */}
                <AllChartsSearchInput
                    searchRef={searchRef}
                    query={query}
                    onQueryChange={setQuery}
                    producerFilters={producerFilters}
                    onRemoveProducerFilter={removeProducerFilter}
                />
            </div>
            {/* Above the panes and as wide as the search input it belongs to,
                rather than inside the list pane: a narrow column wrapped the
                line onto two, and it left the chart sidecar starting a line's
                height above the first row instead of level with it. */}
            <AllChartsSuggestedSearches chips={suggestedChips} />
            <div className="all-charts-block__panes">
                <AllChartsLeftPane
                    variant={variant}
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
    variant: AllChartsVariant
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
        variant,
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

    // Which view of the selected chart to show, when it was picked from a row's
    // thumbnails; `undefined` is the chart's own default view, which is what
    // selecting a row by its text goes back to.
    const [selectedTab, setSelectedTab] = useState<GrapherTabName | undefined>(
        undefined
    )

    // The view the chart on the right is *actually* showing, which is what the
    // row's thumbnails highlight. Not the same thing as `selectedTab`: that is
    // only what a thumbnail click asked for, and it is `undefined` both before
    // anything has been clicked and after a row is selected by its text, while
    // the chart beside it is plainly showing one of the views the thumbnails
    // offer. It also goes stale the moment the visitor uses Grapher's own tab
    // bar. Only the live Grapher knows the answer, so it reports it — see
    // AllChartsSidecar. `undefined` means the chart is on a view the row
    // doesn't offer as a thumbnail (the table), or hasn't loaded yet; either
    // way no thumbnail is highlighted.
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

    // Only the rows on screen. V1 renders a bounded first slice of the list and
    // grows it a batch at a time (see useVisibleChartHits). V2 renders all of
    // it in a contained box instead (see .all-charts-block__list-container) —
    // except on the accordion layout, where it pages like V1 does, only ten
    // rows at a time.
    //
    // Whether the list is paged is part of the reset key alongside the version
    // and the query, so switching versions, or crossing the breakpoint in V2,
    // always starts again from the first batch rather than keeping a count
    // revealed under the other layout.
    const isPaged = variant === "v1" || isAccordionLayout
    const {
        visibleHits: pagedHits,
        nextBatchSize,
        showMore,
    } = useVisibleChartHits(
        hits,
        `${variant}~${isPaged}~${query}`,
        variant === "v1"
            ? ALL_CHARTS_ROW_BATCH_SIZE
            : V2_ACCORDION_ROW_BATCH_SIZE
    )
    const visibleHits = isPaged ? pagedHits : hits

    // Selecting a row by its text opens the sidecar on the chart's own default
    // view, which is what the block itself opens on. Clearing `selectedTab` is
    // what makes that true a second time: without it a row picked after a
    // thumbnail would inherit that thumbnail's view.
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

    const table = (
        <AllChartsTable
            hits={visibleHits}
            selectedIndex={selectedIndex}
            expandedIndex={expandedIndex}
            selectedTab={selectedTab}
            activeTab={activeTab}
            onActiveTabChange={setActiveTab}
            onRowClick={handleRowClick}
            onThumbnailClick={handleThumbnailClick}
            detectedCountries={detectedCountries}
            searchPhrase={searchPhrase}
            duplicatedTitles={duplicatedTitles}
            // True while a new debounced query is fetching in the
            // background (see the keepPreviousData note above) — a
            // subtle dim on the still-visible previous results, rather
            // than the skeleton/blank state `isLoading` triggers on a
            // genuine first load.
            isRefreshing={isFetching && !isLoading}
        />
    )

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
                        {isPaged ? (
                            table
                        ) : (
                            <div className="all-charts-block__list-container">
                                {table}
                            </div>
                        )}
                        {/* The next batch, one click away. Counts the rows the
                            click will really add: a full batch while there are
                            that many left, the remainder on the last one ("Show
                            7 more"), and nothing once the whole list is on
                            screen. Revealing only grows the list until the
                            query changes: collapsing a list the visitor has
                            scrolled into would pull the page up from under
                            them. */}
                        {isPaged && nextBatchSize > 0 && (
                            <AllChartsRevealButton
                                count={nextBatchSize}
                                topicName={topicName}
                                onClick={showMore}
                            />
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
                        onActiveTabChange={setActiveTab}
                    />
                )}
            </div>
        </>
    )
}

/**
 * The "Show N more" control under a paged list: V1's everywhere, and V2's on
 * the accordion layout.
 */
const AllChartsRevealButton = ({
    count,
    topicName,
    onClick,
}: {
    count: number
    topicName: string
    onClick: () => void
}) => (
    <div className="all-charts-block__reveal">
        <Button
            // $blue-20 fill with $blue-90 text: the same theme the search
            // page's own "Show more" control uses (see SearchHorizontalDivider).
            // An outline theme can't be used here: those declare no background,
            // which is invisible on the <a> elements they're used on elsewhere
            // but leaves a <button> showing the browser's default grey.
            theme="solid-light-blue"
            className="all-charts-block__reveal-button"
            text={`Show ${count} more`}
            ariaLabel={`Show ${count} more indicators on ${topicName}`}
            dataTrackNote="all-charts-show-more"
            icon={faChevronDown}
            iconPosition="right"
            onClick={onClick}
        />
    </div>
)

/**
 * The "Suggested: …" line under the search input. A sibling of the input rather
 * than part of the list pane, so it has the full width of the block and reads
 * as belonging to the search above it (see the note at its call site).
 */
const AllChartsSuggestedSearches = ({ chips }: { chips: SuggestedChip[] }) => {
    if (chips.length === 0) return null
    return (
        <div className="all-charts-block__suggested">
            <span className="all-charts-block__suggested-label">
                Suggested:{" "}
            </span>
            {chips.map((chip, index) => (
                <Fragment key={chip.key}>
                    <button
                        type="button"
                        className="all-charts-block__suggested-link"
                        onClick={chip.onClick}
                    >
                        {chip.label}
                    </button>
                    {index < chips.length - 1 && ", "}
                </Fragment>
            ))}
        </div>
    )
}

const AllChartsSearchInput = ({
    searchRef,
    query,
    onQueryChange,
    producerFilters,
    onRemoveProducerFilter,
}: {
    searchRef: React.Ref<HTMLDivElement>
    query: string
    onQueryChange: (query: string) => void
    producerFilters: string[]
    onRemoveProducerFilter: (producer: string) => void
}) => {
    return (
        <>
            <div className="all-charts-block__search" ref={searchRef}>
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
    onThumbnailClick,
    detectedCountries,
    searchPhrase,
    duplicatedTitles,
    isRefreshing,
}: {
    // Only the rows on screen — the batches revealed so far when the list is
    // paged (see useVisibleChartHits), otherwise the whole result set. Always
    // a prefix of it.
    hits: readonly SearchChartHit[]
    selectedIndex: number
    expandedIndex: number | null
    selectedTab?: GrapherTabName
    activeTab?: GrapherTabName
    onRowClick: (index: number) => void
    onActiveTabChange: (tab?: GrapherTabName) => void
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
                    activeTab={activeTab}
                    onActiveTabChange={onActiveTabChange}
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
 * A chart's primary non-map view, or `undefined` for a chart that only has a
 * map. The record's `availableTabs` is Grapher's own tab list — table, map,
 * then the chart types, in tab-bar order (see getRowThumbnailTabs) — so the
 * first entry that is neither is the view the chart leads with.
 */
// oxlint-disable-next-line react/only-export-components -- exported for AllChartsBlock.test.ts; the rule is about fast refresh, and this is a pure helper
export function getPrimaryNonMapTab(
    hit: SearchChartHit
): GrapherTabName | undefined {
    return hit.availableTabs.find(
        (tab) =>
            tab !== GRAPHER_TAB_NAMES.Table &&
            tab !== GRAPHER_TAB_NAMES.WorldMap
    )
}

/**
 * The Grapher view the sidecar is showing for a hit, as a query string — e.g.
 * "?country=~ESP" when the search names a country this chart has data for, and
 * "" when it doesn't. `tab` is the view picked from the row's thumbnails, if
 * any.
 *
 * Without one, a chart whose search selected a country opens on its primary
 * non-map view rather than its own default. A map is the one view that does
 * not render an entity selection at all — it draws every country whatever is
 * selected, which is verifiable: the same thumbnail URL with and without a
 * `country` param comes back byte for byte identical. So a chart that defaults
 * to its map answered a country search by showing exactly what it showed
 * before, and nothing on screen said the search had done anything (Marwa,
 * 2026-09-03 and again 2026-10-01). A map-only chart stays on its map: there
 * is no other view to send it to, and naming a tab the chart hasn't got would
 * be worse than leaving it be.
 *
 * This only sets the view the chart *opens* on. Which view it is *showing*
 * still comes back from the live Grapher (see AllChartsSidecar's
 * registerGrapherState), so the thumbnail highlight follows the chart here
 * exactly as it does after a tab change made inside Grapher.
 */
function getSidecarViewQueryStr(
    hit: SearchChartHit,
    detectedCountries: string[],
    tab?: GrapherTabName
): string {
    const entities = pickEntitiesForChartHit(hit, detectedCountries)
    const entityQueryStr = getEntityQueryStr(entities)
    // Entities rather than `detectedCountries`: a country the search named but
    // this chart has no data for selects nothing, so there is nothing for a
    // non-map view to reveal and the chart keeps its own default.
    const viewTab =
        tab ?? (entities.length > 0 ? getPrimaryNonMapTab(hit) : undefined)
    if (!viewTab) return entityQueryStr
    const tabQueryStr = `tab=${mapGrapherTabNameToQueryParam(viewTab)}`
    return entityQueryStr
        ? `${entityQueryStr}&${tabQueryStr}`
        : `?${tabQueryStr}`
}

// How many of a chart's views a row offers as thumbnails. The rest stay
// reachable through the sidecar's own tab bar.
const MAX_ROW_THUMBNAILS = 3

/**
 * The views a row offers as thumbnails, in the order Grapher's own tab bar
 * lists them — a row reading map, line, bar belongs to a chart whose tabs read
 * Map | Line | Bar, so a visitor can match one to the other at a glance
 * (Marwa, 2026-09-29).
 *
 * That order comes free: the Algolia record's `availableTabs` is Grapher's
 * `availableTabs` verbatim (see getChartsRecords in
 * baker/algolia/utils/charts.ts), which is built as table, map, then the
 * chart types — the tab bar's order. So the strip is that list with the table
 * dropped and the cap applied, and nothing here re-sorts it.
 *
 * Every slot names its view explicitly, which is what keeps the views
 * distinct: a slot that named none — leaving the chart to open on its own
 * default view — rendered the map a second time on every chart that opens on
 * the map, because the record says which tabs a chart has but not which one it
 * opens on. A chart with fewer views than the cap gets fewer thumbnails rather
 * than a repeated one — a map-only chart gets exactly one.
 *
 * The table is never offered: the thumbnail renderer has no table to draw and
 * answers a `tab=table` request with the chart instead.
 */
// oxlint-disable-next-line react/only-export-components -- exported for AllChartsBlock.test.ts; the rule is about fast refresh, and this is a pure helper
export function getRowThumbnailTabs(hit: SearchChartHit): GrapherTabName[] {
    const tabs = (hit.availableTabs ?? []).filter(
        (tab) => tab !== GRAPHER_TAB_NAMES.Table
    )
    // Belt and braces against a record that lists a tab twice: the cap would
    // otherwise spend one of the three slots on a repeat.
    return [...new Set(tabs)].slice(0, MAX_ROW_THUMBNAILS)
}

/**
 * The preview image for one view of one row's chart.
 *
 * `entities` are the countries the search selected that this chart has data
 * for. They go into the URL rather than being applied to the image afterwards
 * because that is the only thing that can change the picture: these are static
 * images, cached by URL, so a selection that isn't in the URL is a selection
 * the visitor never sees (Marwa, 2026-10-01).
 *
 * The map view is the exception, and is drawn for no entities at all. It is the
 * one view that renders the same picture whatever is selected — the deployed
 * thumbnail function returns a byte-identical PNG for a map with and without a
 * `country` param — so putting the selection in its URL would split one cached
 * image into one per combination of countries, on a renderer a whole search is
 * already queueing against, and produce the same image at the end of it. The
 * map stays in the strip, which goes on mirroring Grapher's tab bar; it is the
 * chart beside the list that moves off the map when a country is named (see
 * getSidecarViewQueryStr).
 */
// oxlint-disable-next-line react/only-export-components -- exported for AllChartsBlock.test.ts; the rule is about fast refresh, and this is a pure helper
export function getRowThumbnailPreviewUrl(
    hit: SearchChartHit,
    tab: GrapherTabName,
    entities: EntityName[]
): string {
    return constructPreviewUrl({
        hit,
        grapherParams: toGrapherQueryParams({
            tab,
            entities: tab === GRAPHER_TAB_NAMES.WorldMap ? [] : entities,
        }),
        variant: PreviewVariant.Thumbnail,
        // No labelling at all, so the chart itself gets the whole frame: at a
        // third of the list pane every label in one of these is illegible
        // anyway, and the row's title and source line above already say what it
        // is (Marwa, 2026-09-30).
        //
        // Both flags, not just the second: imMinimal is what takes a map's
        // legend and "No data" key away, and a map has no axes or series labels
        // for imBare to act on. imBare covers the rest — series and entity
        // names, value labels, axis lines and tick labels — and hands the space
        // back to the plot. See useMinimalLabeling and useBareLabeling in
        // packages/@ourworldindata/grapher.
        isMinimal: true,
        isBare: true,
    })
}

// How many times a thumbnail that failed to load is requested before the row
// gives up on it and leaves the slot empty.
const THUMBNAIL_LOAD_ATTEMPTS = 2

/**
 * One thumbnail's image, re-requested once if it fails to load, and left out
 * altogether rather than showing the browser's broken-image icon if it fails
 * again.
 *
 * These are rendered on demand by a Cloudflare function, and a search can ask
 * it for sixty-odd charts at once. Every URL this block builds was checked
 * against that function and answers 200 with a valid 1200x640 PNG: for every
 * combination of record type (chart, multi-dimensional view, explorer view)
 * and chart type on a topic, and for a hundred uncached requests in parallel
 * (2026-10-01). A strip of broken thumbnails is therefore the renderer having
 * a bad moment rather than a URL this block got wrong — but an <img> that
 * fails once stays broken for as long as the row is on screen, which is how
 * one bad moment became the permanent row of broken-image icons the designer
 * photographed. Asking again is what that case needs; nothing here can stop
 * the renderer failing, and this does not pretend to.
 */
const AllChartsRowThumbnailImage = ({ src }: { src: string }) => {
    const [attempt, setAttempt] = useState(1)

    if (attempt > THUMBNAIL_LOAD_ATTEMPTS) return null

    return (
        <img
            // A distinct URL per attempt, so a retry is a fresh request rather
            // than the browser or the CDN handing back the failure it already
            // has. The renderer ignores params it doesn't know (verified
            // against the deployed function: the same URL with an extra param
            // returns the identical image), so this costs the first attempt —
            // the one that almost always succeeds — nothing at all.
            src={attempt === 1 ? src : `${src}&imgRetry=${attempt}`}
            onError={() => setAttempt((n) => n + 1)}
            alt=""
            loading="lazy"
            // The thumbnail's own dimensions, so the browser can reserve the
            // right box before the image lands — a topic page can hold nearly
            // 200 rows of these.
            width={GRAPHER_THUMBNAIL_WIDTH}
            height={GRAPHER_THUMBNAIL_HEIGHT}
        />
    )
}

/**
 * A row's thumbnails: one static preview per view of the chart, from the same
 * thumbnail endpoint the search results' previews use (see constructPreviewUrl).
 * Clicking one selects the row and puts that view in the chart beside it.
 */
const AllChartsRowThumbnails = ({
    hit,
    activeTab,
    isSelected,
    onSelectTab,
    entities,
}: {
    hit: SearchChartHit
    // The view the chart beside the list is showing, reported by that chart
    // rather than inferred from the last thumbnail clicked — so the strip is
    // right on first load and after a tab change made inside Grapher, not just
    // after a click here.
    activeTab?: GrapherTabName
    isSelected: boolean
    onSelectTab: (tab: GrapherTabName) => void
    // The countries the search selected that this chart actually has data for
    // — the same list the row shows as a tag and the chart beside it opens
    // with. The previews are drawn for these rather than for the chart's own
    // default entities, so a strip stops showing a world the visitor has
    // narrowed away from (Marwa, 2026-10-01).
    entities: EntityName[]
}) => {
    const tabs = useMemo(() => getRowThumbnailTabs(hit), [hit])

    return (
        <div className="all-charts-block__row-thumbnails">
            {tabs.map((tab) => {
                const label = makeLabelForGrapherTab(tab, { format: "long" })
                const src = getRowThumbnailPreviewUrl(hit, tab, entities)
                return (
                    <button
                        key={tab}
                        type="button"
                        className={cx("all-charts-block__row-thumbnail", {
                            "all-charts-block__row-thumbnail--active":
                                isSelected && activeTab === tab,
                        })}
                        aria-pressed={isSelected && activeTab === tab}
                        aria-label={`${label}: ${hit.title}`}
                        onClick={() => onSelectTab(tab)}
                    >
                        <AllChartsRowThumbnailImage
                            // A new URL is a new image, and so a fresh set of
                            // load attempts rather than the previous image's.
                            key={src}
                            src={src}
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

/**
 * How far to scroll the page, in pixels (negative is up), so that the chart a
 * row just opened on the accordion layout is centred in the part of the
 * viewport the visitor can see: between `viewTop`, where the pinned sub-nav and
 * search bar stop covering it, and `viewBottom`, its bottom edge. `chartTop`
 * and `chartBottom` are the chart card's viewport offsets as they were when the
 * row was tapped (see AllChartsTableRow).
 *
 * Centred on the card alone, not the row: the row's thumbnails sit just above
 * it, partly in view. A card taller than the visible area has its top put just
 * under the bar instead, so its top is never hidden.
 */
// oxlint-disable-next-line react/only-export-components -- exported for AllChartsBlock.test.ts; the rule is about fast refresh, and this is a pure helper
export function getOpenRowScrollDelta({
    chartTop,
    chartBottom,
    viewTop,
    viewBottom,
}: {
    chartTop: number
    chartBottom: number
    viewTop: number
    viewBottom: number
}): number {
    const room = viewBottom - viewTop - (chartBottom - chartTop)
    return chartTop - (viewTop + Math.max(0, room / 2))
}

const AllChartsTableRow = ({
    hit,
    isSelected,
    isExpanded,
    selectedTab,
    activeTab,
    onSelect,
    onSelectTab,
    onActiveTabChange,
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
    onSelectTab: (tab?: GrapherTabName) => void
    onActiveTabChange: (tab?: GrapherTabName) => void
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

    // On the accordion layout a tap opens this row's chart underneath its
    // thumbnails, and the page is then scrolled to centre it (see
    // getOpenRowScrollDelta). Only on a tap, so the row that opens by itself
    // on load or on a new query leaves the page where it is.
    //
    // The tap may also close a row above this one, taking its chart out of the
    // page. Browsers with scroll anchoring keep this row where it was when that
    // happens; Safari has none, so the row jumps up by the height of the chart
    // that closed, often clean out of sight. So everything is measured after
    // the change has rendered and laid out, against where the row was when it
    // was tapped: any jump is undone at once, and the scroll that brings the
    // chart in starts from where the visitor was looking.
    //
    // What is centred is the chart card, .all-charts-block__grapher, whose
    // height is fixed by the stylesheet ($grapher-height) from the moment it
    // mounts, so it can be measured in the first frame: Grapher initialising
    // inside it (a second or two) doesn't change its size.
    //
    // A no-op on desktop, which never expands a row: the accordion panel isn't
    // rendered, so there is no chart to bring in.
    const rowRef = useRef<HTMLLIElement>(null)
    const chartPanelRef = useRef<HTMLDivElement>(null)
    const openWithChartInView = (open: () => void): void => {
        const rowTopBefore = rowRef.current?.getBoundingClientRect().top
        open()
        requestAnimationFrame(() => {
            const row = rowRef.current
            const chart = chartPanelRef.current?.querySelector(
                ".all-charts-block__grapher"
            )
            if (!row || !chart || rowTopBefore === undefined) return
            const jump = row.getBoundingClientRect().top - rowTopBefore
            const chartRect = chart.getBoundingClientRect()
            const delta = getOpenRowScrollDelta({
                chartTop: chartRect.top - jump,
                chartBottom: chartRect.bottom - jump,
                // The row's scroll-margin-top is the bottom edge of the pinned
                // nav and search bar (see .all-charts-block__row).
                viewTop: parseFloat(getComputedStyle(row).scrollMarginTop) || 0,
                viewBottom: window.innerHeight,
            })
            if (Math.abs(jump) >= 1)
                window.scrollBy({ top: jump, behavior: "instant" })
            if (Math.abs(delta) >= 1)
                window.scrollBy({
                    top: delta,
                    behavior: getPrefersReducedMotion() ? "instant" : "smooth",
                })
        })
    }
    const select = (): void => openWithChartInView(onSelect)
    const selectTab = (tab: GrapherTabName): void =>
        openWithChartInView(() => onSelectTab(tab))

    // Enter/Space activate the row the same way a native <button> would —
    // needed because the click target below is a div (it wraps a multi-line
    // stack of title/subtitle/source spans rather than being a leaf control),
    // so we reimplement that bit of native button keyboard behavior ourselves.
    const handleRowKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault()
            select()
        }
    }

    return (
        <li
            ref={rowRef}
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
                    onClick={select}
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
                    activeTab={activeTab}
                    isSelected={isSelected}
                    onSelectTab={selectTab}
                    entities={shownEntities}
                />
            </div>
            {/* Mobile/tablet accordion panel: the persistent sidecar
                (all-charts-block__right) is hidden below that breakpoint, so
                the selected row's chart is shown inline underneath it
                instead. Rendered only while expanded so the chart isn't
                mounted (and fetched) until a visitor actually opens it. */}
            {isExpanded && (
                <div
                    className="all-charts-block__row-accordion"
                    ref={chartPanelRef}
                >
                    <AllChartsSidecar
                        hit={hit}
                        detectedCountries={detectedCountries}
                        tab={isSelected ? selectedTab : undefined}
                        // Only the selected row's chart drives the highlight,
                        // because only the selected row's thumbnails show it.
                        // On this layout the expanded row is the selected one
                        // anyway; an expanded row that isn't reports nothing
                        // rather than highlighting another row's strip.
                        onActiveTabChange={
                            isSelected ? onActiveTabChange : undefined
                        }
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
    tab?: GrapherTabName
    /**
     * Called with the view this chart is showing, whenever it changes — on
     * load with the view the chart chose for itself, and again every time the
     * visitor uses Grapher's own tab bar. The row's thumbnails highlight it.
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
    // the visitor can switch tabs inside Grapher without touching a thumbnail.
    // Grapher hands its state to whoever provides a GuidedChartContext (see
    // useMaybeGlobalGrapherStateRef), which is how the guided-chart blocks
    // drive a chart from the prose around it — the same door serves here, in
    // the other direction: we only read `activeTab` off it.
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
