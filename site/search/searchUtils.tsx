import * as _ from "lodash-es"
import * as R from "remeda"
import {
    EntityName,
    GRAPHER_TAB_QUERY_PARAMS,
    GrapherQueryParams,
    GrapherTabName,
    GrapherTabQueryParam,
    OwidGdocType,
    TagGraphRoot,
    TimeBounds,
    SearchIndexName,
    Filter,
    FilterType,
    ScoredFilter,
    SearchResultType,
    SearchTopicType,
    ChartRecordType,
    SearchChartHit,
    SearchUrlParam,
    SynonymMap,
    Ngram,
    WordPositioned,
    ScoredFilterPositioned,
} from "@ourworldindata/types"
import {
    Url,
    countriesByName,
    slugify,
    FuzzySearch,
    FuzzySearchResult,
    getAllChildrenOfArea,
    timeBoundToTimeBoundString,
    queryParamsToStr,
    omitUndefinedValues,
    type SearchFacetAttribute,
    getFilterNamesOfType,
    setToFacetFilters,
    formatDisjunctiveFacetFilters,
    formatConjunctiveFacetFilters,
    formatFeaturedMetricFacetFilter,
    formatCountryFacetFilters,
    formatTopicFacetFilters,
} from "@ourworldindata/utils"
import {
    generateSelectedEntityNamesParam,
    isValidTabQueryParam,
    mapGrapherTabNameToQueryParam,
} from "@ourworldindata/grapher"
import { getIndexName } from "./searchClient.js"
import {
    faBook,
    faBookmark,
    faBullhorn,
    faDatabase,
    faFileLines,
    faFlag,
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
} from "../../settings/clientSettings.js"
import { EXPLORERS_ROUTE_FOLDER } from "@ourworldindata/explorer"
import {
    PreviewVariant,
    RichDataComponentVariant,
} from "./SearchChartHitRichDataTypes.js"

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

export type ChartHitIdentityFields = {
    slug: string
    queryParams?: string
}

/**
 * Stable identity for the *chart* a hit renders as a row, used to recognise
 * the same row across two different Algolia result sets.
 *
 * Deliberately not `objectID`. The index carries a separate "Featured Metric"
 * record for some charts — objectID `486-fm-upper-middle-co2-greenhouse-gas-emissions`
 * — alongside the plain record for the same chart, objectID `486`. Which of the
 * two comes back depends on the query: `buildChartsFacetFilters` adds an
 * `isFM:false` facet filter as soon as there is any free-text query, so the
 * empty-query result set is served the FM record and every result set after the
 * first keystroke is served the plain one. The two render as the same row (same
 * slug, same title, same chart), so treating them as different records makes a
 * chart appear to drop out of the list and re-enter as an unrelated new entry.
 *
 * `slug` on its own isn't sufficient either: explorer views and mdim views
 * share a slug and are distinguished only by `queryParams`, so both go into the
 * key. (Verified against the live index: for the CO₂ topic's 196-record
 * unfiltered set this key is unique per row, whereas `objectID` fails to match
 * 3 of the 165 rows returned for "china".)
 */
export function getChartHitIdentity(hit: ChartHitIdentityFields): string {
    return `${hit.slug}${hit.queryParams ?? ""}`
}

export type ChartHitMatchFields = {
    title?: string
    subtitle?: string
    datasetProducers?: string[]
}

/**
 * The text of a chart hit as the all-charts block actually renders it: the row's
 * title, its subtitle, and each producer named in its "Source:" line — kept as
 * separate strings rather than joined, so a query can never be satisfied by
 * words gathered from two of them. That boundary is what keeps the matching
 * honest now that the words need not be adjacent: "united nations poverty
 * platform" finds every one of its words on a row about mean income — "poverty"
 * and "platform" in its producer, "nations" in another field — but never all of
 * them in the same one.
 *
 * Deliberately *only* the visible text. The index makes far more searchable than
 * this — `slug`, `tags`, `datasetProducers`, `availableEntities` — and matching a
 * typed phrase against fields the row doesn't show is exactly what makes results
 * look arbitrary (see filterChartHitsByQueryWords).
 */
function getChartHitRowTexts(hit: ChartHitMatchFields): string[] {
    return [
        hit.title ?? "",
        hit.subtitle ?? "",
        ...(hit.datasetProducers ?? []),
    ].filter((text) => text !== "")
}

/**
 * Words for phrase matching, normalised identically on both sides of the
 * comparison.
 *
 * `slugify` is reused here rather than hand-rolling a normaliser: it lowercases,
 * drops punctuation, and — the part that matters most for our titles — folds
 * subscript digits, so "CO₂ emissions" becomes "co2-emissions" and a visitor
 * typing "co2 emissions" still finds it. It's also the same normalisation the
 * indexed `slug` itself goes through.
 *
 * Whitespace is collapsed to single spaces first because `slugify` only turns
 * *spaces* into separators: a newline or tab is instead removed as punctuation,
 * which would weld the words on either side of it into one.
 */
function splitIntoMatchWords(text: string): string[] {
    return slugify(text.replace(/\s+/g, " "))
        .split("-")
        .filter((word) => word !== "")
}

/**
 * True when every word of `query` appears in `text`, in any order, with the last
 * word of the query allowed to match a prefix.
 *
 * Whole words, not raw substrings: a substring test would report
 * "national poverty line" as found in "…below the International Poverty Line",
 * which is how a search for those words ends up returning charts about extreme
 * poverty (17 of them on the Poverty topic).
 *
 * Prefix on the final word only, which covers two things at once: the visitor is
 * typing, so the last word is routinely half-finished ("national poverty li"),
 * and it makes the singular find the plural — "national poverty line" matches
 * the chart titled "Share of population living below national poverty lines",
 * which is the single most relevant result for that search and which Algolia's
 * own `"exactPhrase"` operator drops.
 *
 * Any order, and with gaps allowed, because requiring the words to be adjacent
 * rejected rows that plainly answer the query: "clean cooking" found nothing on
 * Air Pollution, whose charts all say "access to clean fuels *for* cooking", and
 * "emissions per capita" missed a row titled "Per capita methane emissions".
 * What stops this from letting the noise back in is not adjacency but the field
 * boundary — every word has to be in *one* of the row's texts, and the row's
 * texts are only what it displays. See getChartHitRowTexts and
 * filterChartHitsByQueryWords.
 */
export function textContainsAllQueryWords(
    text: string,
    query: string
): boolean {
    const queryWords = splitIntoMatchWords(query)
    if (queryWords.length === 0) return true

    const textWords = splitIntoMatchWords(text)
    const leadingWords = queryWords.slice(0, -1)
    const lastWord = queryWords[queryWords.length - 1]

    return (
        leadingWords.every((word) => textWords.includes(word)) &&
        textWords.some((word) => word.startsWith(lastWord))
    )
}

/**
 * Keeps only the hits whose own visible text contains every word of `query` — the
 * "find"-like narrowing the all-charts block applies on top of its Algolia
 * results (site/AllChartsBlock.tsx). An empty query keeps everything.
 *
 * Why the block needs this at all: Algolia does require every word of the query
 * to be present, but each word may be found in a *different* searchable
 * attribute of the record, with typo tolerance on top. So on the Poverty topic
 * "national poverty line" matched 34 charts, among them "Mean income or
 * consumption per day", which contains none of the three words: "poverty" came
 * from its producer "World Bank Poverty and Inequality Platform", "line" from
 * elsewhere in its record, and "national" from "United Nations" via typo
 * tolerance. Restricted to the words on the row, the same search returns the 4
 * charts that are actually about national poverty lines.
 *
 * The filter runs client-side rather than as a query parameter for two reasons:
 * Algolia's `"exactPhrase"` operator is token-exact, so quoting the query drops
 * the plural-titled chart (see textContainsAllQueryWords); and the caller already holds
 * the complete result set for its topic (queryAllCharts walks every page), so
 * narrowing it locally can't hide a match on a page that wasn't fetched.
 */
export function filterChartHitsByQueryWords<T extends ChartHitMatchFields>(
    hits: readonly T[],
    query: string
): T[] {
    if (splitIntoMatchWords(query).length === 0) return [...hits]
    return hits.filter((hit) =>
        getChartHitRowTexts(hit).some((text) =>
            textContainsAllQueryWords(text, query)
        )
    )
}

/** A run of `text`, flagged with whether the query matched it. */
export type QueryMatchSegment = { text: string; isMatch: boolean }

// Runs of letters and digits, which is what a "word" is on both sides of the
// comparison below. `\p{N}` rather than `\d` so a subscript digit stays part of
// the word it belongs to: "CO₂" has to arrive at splitIntoMatchWords whole for
// it to fold that to "co2".
const MATCH_WORD_RUN_REGEX = /[\p{L}\p{N}]+/gu

/**
 * Splits `text` into alternating matched/unmatched runs, so a caller can bold
 * the words a query matched (site/AllChartsBlock.tsx bolds them in a row's
 * title, subtitle and producer list).
 *
 * A word is flagged exactly when it is one of the words
 * `textContainsAllQueryWords` looked for — the same normalisation, and the same
 * prefix rule on the query's last word — so what a row shows in bold is what
 * kept that row in the list rather than a second, looser notion of a match.
 * Anything the block strips out of the query before filtering (country names,
 * see extractFiltersFromQuery) is therefore not bolded either, because it never
 * reaches this function.
 *
 * Not Algolia's `_highlightResult`: the block's filtering is client-side and
 * strictly narrower than the query Algolia answered, so its highlights would
 * mark up words that had nothing to do with the row surviving.
 *
 * Whitespace and hyphens *between* two matched words are marked as matched too,
 * so a multi-word query reads as one bold phrase instead of several bold words
 * with unbolded gaps.
 */
export function splitTextByQueryWordMatches(
    text: string,
    query: string
): QueryMatchSegment[] {
    const queryWords = splitIntoMatchWords(query)
    if (queryWords.length === 0 || text === "")
        return text === "" ? [] : [{ text, isMatch: false }]

    const leadingWords = new Set(queryWords.slice(0, -1))
    const lastWord = queryWords[queryWords.length - 1]

    const segments: QueryMatchSegment[] = []
    const push = (chunk: string, isMatch: boolean) => {
        if (chunk === "") return
        const previous = segments.at(-1)
        // Merged rather than appended, so adjacent runs of the same kind come
        // out as one segment (and one <strong> in the markup).
        if (previous?.isMatch === isMatch) previous.text += chunk
        else segments.push({ text: chunk, isMatch })
    }

    const words = [...text.matchAll(MATCH_WORD_RUN_REGEX)]
    const wordMatches = words.map((word) =>
        splitIntoMatchWords(word[0]).some(
            (normalized) =>
                leadingWords.has(normalized) || normalized.startsWith(lastWord)
        )
    )

    let cursor = 0
    words.forEach((word, index) => {
        const gap = text.slice(cursor, word.index)
        const bridgesTwoMatches =
            wordMatches[index] &&
            index > 0 &&
            wordMatches[index - 1] &&
            /^[\s-]*$/.test(gap)
        push(gap, bridgesTwoMatches)
        push(word[0], wordMatches[index])
        cursor = word.index + word[0].length
    })
    push(text.slice(cursor), false)

    return segments
}

// Titles compared the same way query words are, so two titles differing only in
// punctuation or in a subscript ("CO₂ emissions" vs "CO2 emissions") count as
// the collision they visibly are.
function getChartTitleMatchKey(title: string): string {
    return splitIntoMatchWords(title).join(" ")
}

/**
 * The titles that more than one of `hits` carries.
 *
 * Fed the block's *unfiltered* topic result set, so a row's variant name doesn't
 * appear and disappear as a query narrows the list around it.
 */
export function getDuplicatedChartTitles(
    hits: readonly { title?: string }[]
): Set<string> {
    const seen = new Set<string>()
    const duplicated = new Set<string>()
    for (const hit of hits) {
        const key = getChartTitleMatchKey(hit.title ?? "")
        if (key === "") continue
        if (seen.has(key)) duplicated.add(key)
        else seen.add(key)
    }
    return duplicated
}

/**
 * The variant name to show beside a row's title ("age-standardized"), or
 * `undefined` for a row that doesn't need one.
 *
 * Only shown where it does some work: a topic listing two charts called
 * "Greenhouse gas emissions by sector" needs "Lines" and "Stacked areas" to
 * tell them apart, and a title only one chart carries doesn't. A variant name
 * that merely repeats the title is dropped as well — explorer-view records
 * carry the view's own title there.
 */
export function getChartHitVariantName(
    hit: { title?: string; variantName?: string },
    duplicatedTitles: ReadonlySet<string>
): string | undefined {
    const variantName = hit.variantName?.trim()
    if (!variantName) return undefined
    const titleKey = getChartTitleMatchKey(hit.title ?? "")
    if (!duplicatedTitles.has(titleKey)) return undefined
    if (getChartTitleMatchKey(variantName) === titleKey) return undefined
    return variantName
}

/**
 * Re-orders `hits` into the relative order the same charts appear in
 * `baselineHits`. The result is always a permutation of `hits`: nothing is
 * added or dropped, only reordered.
 *
 * Used by the all-charts block (site/AllChartsBlock.tsx), whose rows must
 * always read in that block's default order — the order of its unfiltered,
 * topic-only result set — whatever the visitor has typed. Algolia ranks every
 * result set by relevance to the query text, so without this the surviving rows
 * visibly reshuffle on every keystroke as that text grows.
 *
 * Rows are matched by `getChartHitIdentity`, not by `objectID` — see there for
 * why that distinction is load-bearing rather than incidental.
 *
 * Hits with no counterpart in the baseline (a record indexed between the two
 * queries, say) sort to the end, ordered by their identity. That tie-break is
 * deliberate rather than leaving them equal: equal elements keep their order in
 * `hits`, which is Algolia's relevance order, i.e. precisely the input that
 * changes from keystroke to keystroke. Comparing identities instead makes this
 * a total order that depends only on the two hits being compared, so the output
 * is a function of the *set* of hits and not of the order they arrived in. (An
 * inconsistent comparator would itself be a source of apparent shuffling.)
 */
export function sortHitsByBaselineOrder<T extends ChartHitIdentityFields>(
    hits: readonly T[],
    baselineHits: readonly ChartHitIdentityFields[]
): T[] {
    const baselineIndexByIdentity = new Map<string, number>()
    for (const [index, hit] of baselineHits.entries()) {
        // First occurrence wins, so a duplicated record can't give one chart
        // two different positions.
        const identity = getChartHitIdentity(hit)
        if (!baselineIndexByIdentity.has(identity))
            baselineIndexByIdentity.set(identity, index)
    }

    const positionOf = (hit: T): number =>
        baselineIndexByIdentity.get(getChartHitIdentity(hit)) ??
        Number.MAX_SAFE_INTEGER

    return [...hits].sort((a, b) => {
        const positionDiff = positionOf(a) - positionOf(b)
        if (positionDiff !== 0) return positionDiff
        // Only reachable when both hits are missing from the baseline
        // (baseline positions are unique). Compared with < / > rather than
        // localeCompare so the ordering can't vary with the runtime's locale.
        const identityA = getChartHitIdentity(a)
        const identityB = getChartHitIdentity(b)
        if (identityA < identityB) return -1
        if (identityA > identityB) return 1
        return 0
    })
}

/**
 * Which row of `hits` is selected, given the identity of the chart the visitor
 * last picked — `null` before they have picked anything.
 *
 * Used by the all-charts block (site/AllChartsBlock.tsx) to keep a selection
 * pinned to a *chart* rather than to a position in the list, so that searching
 * narrows the list around whatever the visitor is currently reading instead of
 * snapping the sidecar back to the top of it. Three cases, and the last is the
 * only one that moves the selection:
 *
 * - nothing picked yet → the first row, so the block opens on row 1;
 * - the picked chart is still in the results → wherever it now sits, however
 *   far it has moved (filtering out the rows above it shifts every position);
 * - the picked chart has been filtered out → back to the first row, there
 *   being nothing else to honour.
 *
 * Matching on `getChartHitIdentity` and not on `objectID` is what makes the
 * second case hold from the first character typed: that keystroke swaps the
 * Featured Metric record of some charts for the plain record of the same chart
 * (see getChartHitIdentity), which an objectID-keyed selection would read as
 * its chart having disappeared.
 */
export function resolveSelectedChartIndex(
    hits: readonly ChartHitIdentityFields[],
    selectedIdentity: string | null
): number {
    if (selectedIdentity === null) return 0
    const index = hits.findIndex(
        (hit) => getChartHitIdentity(hit) === selectedIdentity
    )
    return index === -1 ? 0 : index
}

/**
 * How many indicator rows the all-charts block renders before the visitor asks
 * for the rest (see getVisibleChartHits below).
 *
 * A topic's chart list is unbounded — the CO2 topic alone returns 196 rows —
 * and the block renders every one of them into the page, with the chart sidecar
 * held beside the list by `position: sticky`. At 196 rows the list pane is over
 * 18,000px tall, so the sidecar stays pinned for ~17 viewport heights with an
 * empty column beside it, which reads as being stuck in the block while
 * scrolling past it. Rendering a bounded first slice keeps the sticky sidecar
 * (which visitors do want: the chart stays put while the list scrolls) without
 * the pin outlasting the reason for it.
 *
 * 25 rows is enough to fill the sidecar's own height with list — so the pin
 * still does its job for the whole visible list — and short enough that the
 * block is a couple of viewports rather than seventeen.
 */
export const ALL_CHARTS_INITIAL_ROW_COUNT = 25

/**
 * The rows the all-charts block actually renders: the first
 * `initialRowCount` of them until the visitor reveals the rest, all of them
 * afterwards.
 *
 * Deliberately a slice of the full result set rather than a smaller Algolia
 * request: the block's row order is pinned to its unfiltered baseline and its
 * selection is pinned to a chart identity, both of which need the complete
 * result set in hand, and the reveal control's label has to name the true
 * total ("Show all 196 indicators") rather than how much of it is on screen.
 */
export function getVisibleChartHits<T>(
    hits: readonly T[],
    isListExpanded: boolean,
    initialRowCount: number = ALL_CHARTS_INITIAL_ROW_COUNT
): readonly T[] {
    if (isListExpanded) return hits
    return hits.slice(0, Math.max(initialRowCount, 0))
}

/**
 * Whether the all-charts block has rows the visitor hasn't been shown yet, and
 * so needs its reveal control at the bottom of the list. False at exactly
 * `initialRowCount` results as well as below it — a "Show all 25 indicators"
 * button under a list of all 25 of them would do nothing.
 */
export function hasHiddenChartHits(
    totalHitCount: number,
    initialRowCount: number = ALL_CHARTS_INITIAL_ROW_COUNT
): boolean {
    return totalHitCount > initialRowCount
}

/**
 * How many "Suggested:" searches the all-charts block offers.
 *
 * The line has two possible sources — an editorially curated list on the gdoc
 * block, or the OWID topic vocabulary fetched at runtime — and neither is
 * bounded at source: the vocabulary's generator publishes as many terms per
 * topic as it is asked for (eight, at the time of writing) and an author can
 * list any number. Five is a length that still scans as a suggestion rather
 * than a second navigation, which is what eight read as (Marwa, 2026-09-03).
 *
 * A cap of five is where this started; it was removed in 4652205c3 so that the
 * generator's `--max-terms` alone decided the line's length, on the argument
 * that one number in one repo beats two. The line then grew to eight, so the
 * cap is back — and back in the block, because the block is what has to look
 * right, and the vocabulary is shared with whatever else comes to use it.
 */
export const ALL_CHARTS_MAX_SUGGESTED_SEARCHES = 5

/**
 * The suggested searches the all-charts block actually renders: the first
 * `maxCount` of whichever list supplies them.
 *
 * Applied to the chosen list rather than to each source, so a curated list and
 * a vocabulary one are capped identically, and applied by truncation so the
 * order the source chose is kept — the vocabulary's terms are ranked by what
 * each reveals of this topic's charts, so its first five are its best five.
 */
export function capSuggestedSearches<T>(
    suggestions: readonly T[],
    maxCount: number = ALL_CHARTS_MAX_SUGGESTED_SEARCHES
): T[] {
    return suggestions.slice(0, Math.max(maxCount, 0))
}

export function pickEntitiesForChartHit(
    hit: SearchChartHit,
    selectedRegionNames: string[] | undefined
): EntityName[] {
    if (!selectedRegionNames) return []

    const availableEntities =
        hit.originalAvailableEntities ?? hit.availableEntities
    if (!availableEntities) return []

    // Build intersection of selectedRegionNames and availableEntities, so we
    // only select entities that are actually present in the chart
    const filteredEntities = R.intersection(
        selectedRegionNames,
        availableEntities
    )

    // Reverse the order so that the last picked entity is first
    const sortedEntities = filteredEntities.toReversed()

    return sortedEntities
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
    grapherQueryStr: extraGrapherQueryStr,
}: {
    hit: SearchChartHit
    grapherParams?: GrapherQueryParams
    grapherQueryStr?: string
}): string => {
    const isExplorerView = hit.type === ChartRecordType.ExplorerView
    const isMultiDimView = hit.type === ChartRecordType.MultiDimView

    const viewQueryStr =
        isExplorerView || isMultiDimView ? hit.queryParams : undefined
    const grapherQueryStr = grapherParams
        ? queryParamsToStr(grapherParams)
        : undefined

    // Remove leading '?' from query strings
    const queryStrList = [viewQueryStr, grapherQueryStr, extraGrapherQueryStr]
        .map((queryStr) => queryStr?.replace(/^\?/, ""))
        .filter((queryStr) => queryStr)

    const queryStr = queryStrList.length > 0 ? "?" + queryStrList.join("&") : ""

    return queryStr
}

export const constructChartUrl = ({
    hit,
    grapherParams,
    grapherQueryStr,
    overlay,
}: {
    hit: SearchChartHit
    grapherParams?: GrapherQueryParams
    /**
     * Already-serialised Grapher query string (e.g. "?country=~ESP"), merged
     * in alongside `grapherParams`. Opt-in and unused by /search: it exists so
     * a caller that already holds the exact query string it handed to a live
     * Grapher can put *that* string on the chart's link, instead of rebuilding
     * an equivalent param list that could drift from it.
     */
    grapherQueryStr?: string
    overlay?: "sources" | "download-data"
}): string => {
    const viewQueryStr = generateQueryStrForChartHit({
        hit,
        grapherParams,
        grapherQueryStr,
    })
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
    const viewQueryStr = generateQueryStrForChartHit({ hit, grapherParams })

    // Always ignore projected data to ensure that the data display shows a
    // historical data point
    const queryStr = viewQueryStr
        ? `${viewQueryStr}&ignoreProjections`
        : "?ignoreProjections"

    const isExplorerView = hit.type === ChartRecordType.ExplorerView
    const basePath = isExplorerView
        ? EXPLORER_DYNAMIC_THUMBNAIL_URL
        : GRAPHER_DYNAMIC_THUMBNAIL_URL

    return `${basePath}/${hit.slug}.values.json${queryStr}`
}

export const constructSearchResultUrl = ({
    hit,
    params,
}: {
    hit: SearchChartHit
    params: {
        version: number
        variant: RichDataComponentVariant
        entities?: EntityName[]
        numDataTableRowsPerColumn?: number
    }
}): string | undefined => {
    const viewQueryStr = generateQueryStrForChartHit({ hit })

    let optionsQueryStr = `version=${params.version}&variant=${params.variant}&ignoreProjections`
    if (params.entities && params.entities.length > 0)
        optionsQueryStr += `&entities=${generateSelectedEntityNamesParam(params.entities)}`
    if (params.numDataTableRowsPerColumn) {
        optionsQueryStr += `&numDataTableRowsPerColumn=${params.numDataTableRowsPerColumn}`
    }

    // Combine view and options query strings
    const queryParts = [
        viewQueryStr?.replace(/^\?/, ""),
        optionsQueryStr,
    ].filter((queryStr) => queryStr)
    const queryStr = queryParts.length > 0 ? `?${queryParts.join("&")}` : ""

    const isExplorerView = hit.type === ChartRecordType.ExplorerView
    const basePath = isExplorerView
        ? EXPLORER_DYNAMIC_THUMBNAIL_URL
        : GRAPHER_DYNAMIC_THUMBNAIL_URL

    return `${basePath}/${hit.slug}.search-result.json${queryStr}`
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

export const CHARTS_INDEX = getIndexName(
    SearchIndexName.ExplorerViewsMdimViewsAndCharts
)
export const PAGES_INDEX = getIndexName(SearchIndexName.Pages)
export const PAGES_CHRONOLOGICAL_INDEX = getIndexName(
    SearchIndexName.PagesChronological
)
export const DATA_CATALOG_ATTRIBUTES = [
    "title",
    "containerTitle",
    "slug",
    "availableEntities",
    "originalAvailableEntities",
    "variantName",
    "titleVariant",
    "type",
    "queryParams",
    "availableTabs",
    "subtitle",
    "chartConfigId",
    "explorerType",
    "datasetProducers",
]

// Re-exported for existing importers; the actual definitions live in
// @ourworldindata/utils so functions/api/search/searchApi.ts (which can't
// import from site/) shares them too, keeping Algolia facetFilters identical
// between the site's search UI and the public /api/search endpoint.
export type { SearchFacetAttribute }
export {
    getFilterNamesOfType,
    setToFacetFilters,
    formatDisjunctiveFacetFilters,
    formatConjunctiveFacetFilters,
    formatFeaturedMetricFacetFilter,
    formatCountryFacetFilters,
    formatTopicFacetFilters,
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

export function serializeSet(set: Set<string>) {
    return set.size ? [...set].join("~") : undefined
}

export function deserializeSet(str: string | null): Set<string> {
    return str ? new Set(str.split("~")) : new Set()
}

export const getFilterIcon = (filter: Filter) => {
    return match(filter.type)
        .with(FilterType.COUNTRY, () => {
            // Some countries filters might be regions or historical countries,
            // for which we don't show a flag. By looking for potential region
            // names in the countries list, we're effectively filtering out
            // non-country regions.
            const countryCode = countriesByName()[filter.name]?.code
            return countryCode ? (
                <img
                    className="flag"
                    aria-hidden={true}
                    height={12}
                    width={16}
                    src={`/images/flags/${countryCode}.svg`}
                />
            ) : null
        })
        .with(FilterType.TOPIC, () => (
            <span className="icon">
                <FontAwesomeIcon icon={faTag} />
            </span>
        ))
        .with(
            FilterType.DATASET_PRODUCT,
            FilterType.DATASET_NAMESPACE,
            FilterType.DATASET_VERSION,
            FilterType.DATASET_PRODUCER,
            () => (
                <span className="icon">
                    <FontAwesomeIcon icon={faDatabase} />
                </span>
            )
        )
        .with(FilterType.QUERY, () => null)
        .exhaustive()
}

export function findTopicAndRegionFilters(
    words: string[],
    allRegionsNames: string[],
    allTopics: string[],
    selectedRegionNames: Set<string>,
    selectedTopics: Set<string>,
    synonymMap: SynonymMap,
    sortOptions: { threshold: number; limit: number }
): ScoredFilter[] {
    const searchTerm = words.join(" ")

    const searchCountryTopics = (term: string) => {
        const countryFilters: ScoredFilter[] = FuzzySearch.withKey(
            allRegionsNames,
            _.identity,
            sortOptions
        )
            .searchResults(term)
            .filter(
                (result: FuzzySearchResult) =>
                    !selectedRegionNames.has(result.target)
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
                R.sortBy([R.prop("score"), "desc"]),
                R.uniqueBy((filter) => filter.name),
                R.take(sortOptions.limit)
            )
        )
    )

    return filters
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
export function suggestFiltersFromQuerySuffix(
    query: string,
    allRegionNames: string[],
    allTopics: string[],
    filters: Filter[], // currently active filters to exclude from suggestions
    synonymMap: SynonymMap,
    sortOptions: { threshold: number; limit: number } = {
        threshold: 0.75,
        limit: 3,
    }
): {
    suggestions: Filter[]
    unmatchedQuery: string
} {
    const selectedCountryNames = getFilterNamesOfType(
        filters,
        FilterType.COUNTRY
    )
    const selectedTopics = getFilterNamesOfType(filters, FilterType.TOPIC)

    const queryWords = splitIntoWords(query)

    if (!queryWords.length || queryWords[0] === "") {
        return {
            suggestions: [],
            unmatchedQuery: "",
        }
    }

    let matchedFilters: ScoredFilter[] = []
    let matchStartIndex = queryWords.length

    for (let i = 0; i < queryWords.length; i++) {
        const wordsToSearch = queryWords.slice(i)
        const filters = findTopicAndRegionFilters(
            wordsToSearch,
            allRegionNames,
            allTopics,
            selectedCountryNames,
            selectedTopics,
            synonymMap,
            sortOptions
        )

        if (filters.length > 0) {
            matchedFilters = filters
            matchStartIndex = i
            break
        }
    }

    const unmatchedQuery = queryWords.slice(0, matchStartIndex).join(" ")

    const countryMatches = matchedFilters.filter(
        (f) =>
            // remove exact matches from country suggestions, as exact matches are
            // already handled by automatic filters (see SearchDetectedFilters).
            f.type === FilterType.COUNTRY &&
            f.score !== 1 &&
            // we matched on all regions to stop the iteration when a region is
            // found, and avoid suggesting countries contained in that region's
            // name (e.g. if "East Germany" is found, stop the iteration to
            // prevent finding "Germany"). However, we don't want to pollute the
            // autocomplete results with historical regions or aggregates, so we
            // filter them out of the suggestions.
            countriesByName()[f.name]
    )

    const topicMatches = matchedFilters.filter(
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
 * Validates whether an n-gram should be used for filter matching.
 * Filters out n-grams that:
 * - Overlap with already matched word positions
 * - Contain quoted words
 * - Start or end with stop words
 */
const isNotValidNgram = (
    ngram: Ngram,
    quotedWordPositions: Set<number>,
    matchedWordPositions: Set<number>
): boolean => {
    return (
        ngram.some(
            ({ position }) =>
                matchedWordPositions.has(position) ||
                quotedWordPositions.has(position)
        ) || hasLeadingTrailingStopWords(ngram)
    )
}

/**
 * Generator function that yields n-grams from largest to smallest.)
 */
function* generateNgrams(
    tokens: WordPositioned[],
    maxSize: number
): Generator<Ngram> {
    for (let n = maxSize; n >= 1; n--) {
        for (let i = 0; i <= tokens.length - n; i++) {
            yield tokens.slice(i, i + n)
        }
    }
}

/**
 * Gets filter suggestions using contiguous sequence of words (n-grams) for
 * multi-entity matching in a given query.
 *
 * Where `suggestFiltersFromQuerySuffix` progressively tries to match
 * from increasing starting points in the query and returns a list of possible
 * matches for that position (1 position, multiple matches), this function tries
 * to find the best match for all possible contiguous sequences of words
 * (n-grams) in the query (multiple positions, 1 match per position).
 *
 * Generates n-grams from 1 to 4 non stop-words, non quotes phrases,
 * prioritizing longer phrases over shorter ones. Uses overlap detection to
 * prevent the same word positions from being matched multiple times. Keeps a
 * single country or filter topic per n-gram then deduplicates overall results
 * by name.
 *
 * @returns Array of deduplicated scored filters
 */
export function extractFiltersFromQuery(
    query: string,
    allRegionNames: string[],
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

    const allFilters: ScoredFilterPositioned[] = []
    const matchedWordPositions = new Set<number>()

    const words = splitIntoWords(query)

    // Get positions of words inside quoted phrases
    const quotedWordPositions = getQuotedWordPositions(words)

    const tokens: WordPositioned[] = words.map((word, index) => ({
        word,
        position: index,
    }))

    const maxNgramSize = Math.min(tokens.length, 4) // Topics and countries mostly fit within 4 words

    // Generate and process n-grams on-the-fly, prioritizing longer phrases
    for (const ngram of generateNgrams(tokens, maxNgramSize)) {
        if (isNotValidNgram(ngram, quotedWordPositions, matchedWordPositions)) {
            continue
        }

        const ngramWords = R.map(ngram, R.prop("word"))
        const ngramPositions = R.map(ngram, R.prop("position"))

        const filtersFromNgram = findTopicAndRegionFilters(
            ngramWords,
            allRegionNames,
            allTopics,
            selectedCountryNames,
            selectedTopics,
            synonymMap,
            sortOptions
        )

        const bestFilter = _.maxBy(filtersFromNgram, (f) => f.score)
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

export function createFilter(type: FilterType) {
    return (name: string): Filter => ({ type, name })
}

export const createCountryFilter = createFilter(FilterType.COUNTRY)
export const createTopicFilter = createFilter(FilterType.TOPIC)
export const createQueryFilter = createFilter(FilterType.QUERY)
export const createDatasetProductsFilter = createFilter(
    FilterType.DATASET_PRODUCT
)
export const createDatasetNamespaceFilter = createFilter(
    FilterType.DATASET_NAMESPACE
)
export const createDatasetVersionFilter = createFilter(
    FilterType.DATASET_VERSION
)
export const createDatasetProducerFilter = createFilter(
    FilterType.DATASET_PRODUCER
)

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

export const buildFilterTestId = (
    baseTestId: string,
    filterType: FilterType,
    filterName: string
): string => {
    // Topic names use " and " internally but are displayed as " & ".
    // See also getTopicFromUrl in search.steps.ts for the same
    // transformation applied to URL params.
    const displayName =
        filterType === FilterType.TOPIC
            ? filterName.replaceAll(" and ", " & ")
            : filterName
    return `${baseTestId}-${filterType}-${encodeURIComponent(displayName)}`
}

export const getFilterAriaLabel = (
    filter: Filter,
    action: "add" | "remove"
) => {
    const actionName = action === "add" ? "Add" : "Remove"
    const filterTypeLabel = match(filter.type)
        .with(FilterType.DATASET_PRODUCT, () => "dataset product")
        .with(FilterType.DATASET_NAMESPACE, () => "dataset namespace")
        .with(FilterType.DATASET_VERSION, () => "dataset version")
        .with(FilterType.DATASET_PRODUCER, () => "dataset producer")
        .with(FilterType.COUNTRY, () => "country")
        .with(FilterType.TOPIC, () => "topic")
        .with(FilterType.QUERY, () => "query")
        .exhaustive()

    return match(filter.type)
        .with(FilterType.QUERY, () => `Search for ${filter.name}`)
        .with(
            P.union(
                FilterType.COUNTRY,
                FilterType.TOPIC,
                FilterType.DATASET_PRODUCT,
                FilterType.DATASET_NAMESPACE,
                FilterType.DATASET_VERSION,
                FilterType.DATASET_PRODUCER
            ),
            () => `${actionName} ${filter.name} ${filterTypeLabel} filter`
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
 * Checks if any dataset-related filters are present in the filters array.
 */
export const hasDatasetFilters = (filters: Filter[]): boolean => {
    return filters.some(
        (filter) =>
            filter.type === FilterType.DATASET_PRODUCT ||
            filter.type === FilterType.DATASET_NAMESPACE ||
            filter.type === FilterType.DATASET_VERSION ||
            filter.type === FilterType.DATASET_PRODUCER
    )
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
    return hasDatasetFilters(filters)
        ? SearchResultType.DATA
        : isBrowsing(filters, query) &&
            desiredResultType === SearchResultType.ALL
          ? SearchResultType.DATA
          : desiredResultType
}

export const getUrlParamNameForFilter = (filter: Filter) =>
    match(filter.type)
        .with(FilterType.COUNTRY, () => SearchUrlParam.COUNTRY)
        .with(FilterType.TOPIC, () => SearchUrlParam.TOPIC)
        .with(FilterType.QUERY, () => SearchUrlParam.QUERY)
        .with(FilterType.DATASET_PRODUCT, () => SearchUrlParam.DATASET_PRODUCT)
        .with(
            FilterType.DATASET_NAMESPACE,
            () => SearchUrlParam.DATASET_NAMESPACE
        )
        .with(FilterType.DATASET_VERSION, () => SearchUrlParam.DATASET_VERSION)
        .with(
            FilterType.DATASET_PRODUCER,
            () => SearchUrlParam.DATASET_PRODUCER
        )
        .exhaustive()

/**
 * Builds a fully qualified search URL for the provided autocomplete filter.
 *
 * - add  a `resultType=ALL` parameter to broaden search results beyond the
 *   default data-only view
 * - `COUNTRY` filters include unmatched query terms
 *
 * Examples:
 * - Country filter "Kenya" with unmatched query "emissions":
 *   "?country=Kenya&q=emissions&resultType=all"
 * - Topic filter "Health" (unmatched query discarded, if any):
 *   "?topic=Health&resultType=all"
 * - Query filter "outdoor": "?q=outdoor&resultType=all"
 *
 * See also `SearchAutocomplete.tsx` for similar logic in the search page.
 */
export const getItemUrlForFilter = (
    filter: Filter,
    unmatchedQuery: string
): string => {
    const filterParam = {
        [getUrlParamNameForFilter(filter)]: filter.name,
        [SearchUrlParam.RESULT_TYPE]: SearchResultType.ALL,
    }

    const queryParams = match(filter.type)
        .with(FilterType.COUNTRY, () => ({
            ...filterParam,
            ...(unmatchedQuery && {
                [SearchUrlParam.QUERY]: unmatchedQuery,
            }),
        }))
        .with(
            FilterType.QUERY,
            FilterType.TOPIC,
            FilterType.DATASET_PRODUCT, // only for exhaustiveness, not used in autocomplete
            FilterType.DATASET_NAMESPACE, // only for exhaustiveness, not used in autocomplete
            FilterType.DATASET_VERSION, // only for exhaustiveness, not used in autocomplete
            FilterType.DATASET_PRODUCER, // only for exhaustiveness, not used in autocomplete
            () => filterParam
        )
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
        .with(OwidGdocType.Profile, () => ({
            name: "Country Profile",
            icon: faFlag,
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

const hasLeadingTrailingStopWords = (ngram: Ngram) => {
    if (ngram.length === 0) return false
    const firstWord = ngram[0].word.toLowerCase()
    const lastWord = ngram[ngram.length - 1].word.toLowerCase()
    return STOP_WORDS.has(firstWord) || STOP_WORDS.has(lastWord)
}
