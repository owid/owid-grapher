import {
    AI_SEARCH_MODELS,
    AiSearchBlock,
    AiSearchChartSize,
    AiSearchContentBlock,
    AiSearchSettings,
    DataInsightHit,
    DEFAULT_AI_SEARCH_SETTINGS,
    FlatArticleHit,
    GRAPHER_TAB_NAMES,
    GrapherTabName,
    OwidGdocType,
    SearchChartHit,
    TopicPageHit,
} from "@ourworldindata/types"

export const MAX_QUERY_LENGTH = 200
const MAX_EXPANSION_QUERIES = 6

// How many charts and pages the model chooses from
export const CHART_POOL_SIZE = 100
export const PAGE_POOL_SIZE = 30

/** Reads the prototype settings from the query string, ignoring bad values */
export function parseAiSearchSettings(
    params: URLSearchParams
): AiSearchSettings {
    const model = params.get("model")
    return {
        model:
            AI_SEARCH_MODELS.find((option) => option === model) ??
            DEFAULT_AI_SEARCH_SETTINGS.model,
        debug: params.has("debug")
            ? params.get("debug") === "1"
            : DEFAULT_AI_SEARCH_SETTINGS.debug,
    }
}

/** A chart hit with the ranking hints we retrieve for the model */
export type ChartCandidate = SearchChartHit & {
    keyChartForTags?: string[]
    numRelatedArticles?: number
}

export type PageCandidate = TopicPageHit | FlatArticleHit | DataInsightHit

export interface RankedHits {
    charts: ChartCandidate[]
    pages: PageCandidate[]
}

/** Candidates get short numeric ids, which keep the prompt small */
export interface CandidatePool {
    charts: Map<number, ChartCandidate>
    pages: Map<number, PageCandidate>
}

/**
 * Interleaves the original search with the expansion searches so that each
 * expansion gets a share of the pool: per rank, three hits from the original
 * search and one from each expansion. Duplicates keep their first position.
 */
export function buildCandidatePool(
    lists: RankedHits[],
    { charts: chartPoolSize, pages: pagePoolSize } = {
        charts: CHART_POOL_SIZE,
        pages: PAGE_POOL_SIZE,
    }
): CandidatePool {
    const charts = new Map<number, ChartCandidate>()
    const pages = new Map<number, PageCandidate>()
    const seen = new Set<string>()
    let nextId = 1

    const longest = Math.max(
        0,
        ...lists.map((list) => Math.max(list.charts.length, list.pages.length))
    )
    for (let rank = 0; rank < longest; rank++) {
        for (const [listIndex, list] of lists.entries()) {
            const take = listIndex === 0 ? 3 : 1
            for (let k = 0; k < take; k++) {
                const position = rank * take + k
                const chart = list.charts[position]
                const chartKey = chart && `chart:${chart.objectID}`
                if (
                    chart &&
                    charts.size < chartPoolSize &&
                    !seen.has(chartKey)
                ) {
                    seen.add(chartKey)
                    charts.set(nextId++, chart)
                }
                const page = list.pages[position]
                const pageKey = page && `page:${page.type}/${page.slug}`
                if (page && pages.size < pagePoolSize && !seen.has(pageKey)) {
                    seen.add(pageKey)
                    pages.set(nextId++, page)
                }
            }
        }
    }
    return { charts, pages }
}

export const poolSize = (pool: CandidatePool): number =>
    pool.charts.size + pool.pages.size

export function plannerPrompt(query: string, topTitles: string[]): string {
    const angles =
        "how it varies across countries today, its long-run history, breakdowns (by age, sex, cause, region, income), correlates and drivers (e.g. versus GDP per capita, health spending, education), and closely related topics"
    const intro = `A reader searched Our World in Data (OWID) for: "${query}"

OWID's keyword search only matches words in titles and descriptions, and only returns content that contains every word of the search.`

    if (!topTitles.length)
        return `${intro} This search found nothing, usually because it is phrased as a question or sentence.

Suggest up to ${MAX_EXPANSION_QUERIES} short keyword searches (2 to 4 words each, using words likely to appear in OWID chart or article titles) that would find content to answer it. Start with the searches that capture what the reader is asking about most directly, then cover other main angles of the topic: ${angles}.`

    return `${intro}

Our keyword search found these as the top matches:
${topTitles.map((title) => "- " + title).join("\n")}

Suggest up to ${MAX_EXPANSION_QUERIES} additional short keyword searches (2 to 4 words each, using words likely to appear in OWID chart or article titles) that would find content covering the other main angles of this topic: ${angles}. If the search could mean several distinct things, cover each of them. Don't repeat the original search. If the search is already very specific, suggest fewer.`
}

export const PLANNER_SCHEMA = {
    type: "object",
    properties: {
        queries: { type: "array", items: { type: "string" } },
    },
    required: ["queries"],
    additionalProperties: false,
} as const

/** The expansion searches from the planner's JSON answer */
export function parsePlannerAnswer(text: string, query: string): string[] {
    let parsed: unknown
    try {
        parsed = JSON.parse(text)
    } catch {
        return []
    }
    const queries = (parsed as { queries?: unknown })?.queries
    if (!Array.isArray(queries)) return []
    const original = query.trim().toLowerCase()
    return [
        ...new Set(
            queries
                .filter((q): q is string => typeof q === "string")
                .map((q) => q.trim().slice(0, MAX_QUERY_LENGTH))
                .filter((q) => q && q.toLowerCase() !== original)
        ),
    ].slice(0, MAX_EXPANSION_QUERIES)
}

const TAB_LABELS: Partial<Record<GrapherTabName, string>> = {
    [GRAPHER_TAB_NAMES.LineChart]: "line",
    [GRAPHER_TAB_NAMES.WorldMap]: "map",
    [GRAPHER_TAB_NAMES.DiscreteBar]: "bar",
    [GRAPHER_TAB_NAMES.StackedDiscreteBar]: "bar",
    [GRAPHER_TAB_NAMES.ScatterPlot]: "scatter",
    [GRAPHER_TAB_NAMES.StackedArea]: "stacked area",
    [GRAPHER_TAB_NAMES.SlopeChart]: "slope",
    [GRAPHER_TAB_NAMES.StackedBar]: "stacked bar",
    [GRAPHER_TAB_NAMES.Marimekko]: "marimekko",
}

const PAGE_KIND_LABELS: Record<PageCandidate["type"], string> = {
    [OwidGdocType.TopicPage]: "topic page",
    [OwidGdocType.LinearTopicPage]: "topic page",
    [OwidGdocType.Article]: "article",
    [OwidGdocType.AboutPage]: "article",
    [OwidGdocType.DataInsight]: "data insight",
}

function chartLine(id: number, chart: ChartCandidate): string {
    const tabs = [...new Set(chart.availableTabs.map((tab) => TAB_LABELS[tab]))]
        .filter(Boolean)
        .join(", ")
    const variant = chart.variantName ? ` (${chart.variantName})` : ""
    const keyChart = chart.keyChartForTags?.length ? " | KEY CHART" : ""
    const cited = chart.numRelatedArticles ?? 0
    return `${id} | chart | ${chart.title}${variant} | ${tabs}${keyChart} | cited in ${cited} articles | ${(chart.subtitle ?? "").slice(0, 130)}`
}

function pageLine(id: number, page: PageCandidate): string {
    const byline =
        "authors" in page
            ? [page.authors?.slice(0, 2).join(", "), page.date?.slice(0, 4)]
                  .filter(Boolean)
                  .join(" ")
            : ""
    const excerpt = "excerpt" in page ? (page.excerpt ?? "") : ""
    return `${id} | ${PAGE_KIND_LABELS[page.type]} | ${page.title} | ${byline} | ${excerpt.slice(0, 150)}`
}

export function composerPrompt(query: string, pool: CandidatePool): string {
    return `You are laying out the search results page for Our World in Data (OWID), which publishes research and data on the world's largest problems.

A reader searched for: "${query}"

Below is the OWID content our keyword search found. Work out what the reader most likely wants, then lay out a page that serves it, from the blocks described below. The shape of the page should follow the intent. Someone looking up one thing ("life expectancy nigeria") is best served by one prominent chart and a few close neighbours. A broad topic ("obesity") calls for its topic page and a few groups covering the main questions people have about it. A short word that can mean quite different things ("food") calls for asking which one they mean. A question about how two things relate calls for the chart that shows the relationship. These are illustrations, not templates: combine blocks however serves the reader best.

Blocks:
- {"type":"chart","id":12,"size":"large","country":"Nigeria"}
  A chart. "large" is a big interactive-looking card with the chart and a data table: the page's headline, for the one chart that best answers the search. "medium" is a wide card with the chart, a table, a map and a headline number. Both take a whole screen row and load real data, so the page has at most two of them, usually a single large one at the top. "small" is a thumbnail with the chart's title; consecutive small charts sit side by side, four to a row. When the search names a country or region, add "country" (its exact name) to every chart where it applies, since that place is what the reader asked about; the chart then shows that place's data. Leave it out otherwise.
- {"type":"page","id":34}
  A topic page, article or data insight card.
- {"type":"group","title":"...","blurb":"...","blocks":[...]}
  A titled section that shows its chart and page blocks as a row of cards, four to a row (charts as thumbnails, whatever size you give them). 2 to 4 charts make a good group, plus at most two pages. Title: plain language, sentence case, at most 6 words. Blurb: one short sentence saying what the section shows.
- {"type":"forks","question":"...","options":[{"label":"...","query":"..."}]}
  For a search that could mean distinct things: 2 to 4 options. Picking one runs a new search for its query, so make each query specific (2 to 5 words). Put this block first, then add a few charts that help whichever meaning the reader had.
- {"type":"related","queries":["..."]}
  3 to 5 searches the reader might try next. Put it last.

Ground rules:
- Use only ids from the list below, and each id at most once.
- Titles, blurbs, questions and labels orient the reader; they don't answer the question. Don't state numbers, trends or findings: readers trust OWID for exact data and anything written here hasn't been checked against it. The charts carry the facts.
- When charts are otherwise equal, prefer KEY CHARTs, charts cited in many articles and headline charts over niche variants, and avoid near-duplicates unless the difference is the point.
- The first screen matters most, so put the most useful block first. Keep the page short enough to take in: a headline chart, 2 to 4 groups and the related searches are usually plenty. Leave out content that only repeats what's already shown; the full keyword results appear below this page anyway.
- If OWID only covers the search indirectly, lay out the closest content we have without commenting on what's missing.

Output format: JSON Lines, one block per line in page order, nothing else (no code fences, no commentary).

Content (id | kind | title | details):
${[
    ...[...pool.charts].map(([id, chart]) => chartLine(id, chart)),
    ...[...pool.pages].map(([id, page]) => pageLine(id, page)),
].join("\n")}`
}

const CHART_SIZES: readonly AiSearchChartSize[] = ["large", "medium", "small"]

const str = (value: unknown): string =>
    typeof value === "string" ? value.trim() : ""

const strings = (value: unknown): string[] =>
    (Array.isArray(value) ? value : []).map(str).filter(Boolean)

/**
 * Returns a parser for the lines of the composer's JSON Lines output. Each
 * line becomes a block whose ids are replaced by the hits they refer to.
 * Ids that aren't in the pool or were already used are dropped. Charts in
 * groups become small, a second large chart becomes medium, and charts after
 * the second large or medium one become small. Lines that don't make a
 * usable block give null. The model is told all of this, but isn't guaranteed to
 * comply.
 */
export function createBlockParser(
    pool: CandidatePool
): (rawLine: string) => AiSearchBlock | null {
    const usedIds = new Set<number>()
    // Large and medium cards take a whole row each, so the page has at most
    // one large card and two such cards in all
    let hasLargeChart = false
    let wideChartCount = 0

    const resolveContent = (
        obj: Record<string, unknown>,
        {
            defaultSize,
            inGroup,
        }: { defaultSize: AiSearchChartSize; inGroup: boolean }
    ): AiSearchContentBlock | null => {
        const id = Number(obj.id)
        if (usedIds.has(id)) return null

        const chart = obj.type === "chart" && pool.charts.get(id)
        if (chart) {
            usedIds.add(id)
            let size =
                CHART_SIZES.find((option) => option === obj.size) ?? defaultSize
            // Groups show their charts as thumbnails
            if (inGroup) size = "small"
            if (size === "large" && hasLargeChart) size = "medium"
            if (size !== "small" && wideChartCount >= 2) size = "small"
            if (size === "large") hasLargeChart = true
            if (size !== "small") wideChartCount++
            const country = findEntity(chart, str(obj.country))
            return {
                type: "chart",
                hit: chart,
                size,
                ...(country && { country }),
            }
        }

        const page = obj.type === "page" && pool.pages.get(id)
        if (page) {
            usedIds.add(id)
            return pageBlock(page)
        }
        return null
    }

    return (rawLine) => {
        const obj = parseJsonLine(rawLine)
        if (!obj) return null

        switch (obj.type) {
            case "chart":
            case "page":
                return resolveContent(obj, {
                    defaultSize: "medium",
                    inGroup: false,
                })
            case "group": {
                // Checked first, so a rejected group doesn't use up its ids
                const title = str(obj.title)
                if (!title) return null
                const blocks = (Array.isArray(obj.blocks) ? obj.blocks : [])
                    .filter(
                        (child): child is Record<string, unknown> =>
                            typeof child === "object" && child !== null
                    )
                    .map((child) =>
                        resolveContent(child, {
                            defaultSize: "small",
                            inGroup: true,
                        })
                    )
                    .filter((block) => block !== null)
                if (!blocks.length) return null
                return { type: "group", title, blurb: str(obj.blurb), blocks }
            }
            case "forks": {
                const options = (Array.isArray(obj.options) ? obj.options : [])
                    .map((option) => ({
                        label: str(option?.label),
                        query: str(option?.query).slice(0, MAX_QUERY_LENGTH),
                    }))
                    .filter((option) => option.label && option.query)
                    .slice(0, 4)
                if (options.length < 2) return null
                return { type: "forks", question: str(obj.question), options }
            }
            case "related": {
                const queries = strings(obj.queries)
                    .map((query) => query.slice(0, MAX_QUERY_LENGTH))
                    .slice(0, 5)
                return queries.length ? { type: "related", queries } : null
            }
        }
        return null
    }
}

function parseJsonLine(rawLine: string): Record<string, unknown> | null {
    const line = rawLine
        .trim()
        .replace(/^```(json)?/, "")
        .replace(/```$/, "")
        .trim()
    if (!line.startsWith("{")) return null
    try {
        const parsed = JSON.parse(line)
        return typeof parsed === "object" && parsed !== null ? parsed : null
    } catch {
        return null
    }
}

/** The chart's own spelling of an entity it has data for, if any */
function findEntity(chart: ChartCandidate, name: string): string | undefined {
    if (!name) return undefined
    const entities = chart.originalAvailableEntities ?? chart.availableEntities
    const lower = name.toLowerCase()
    return entities?.find((entity) => entity.toLowerCase() === lower)
}

function pageBlock(page: PageCandidate): AiSearchContentBlock {
    switch (page.type) {
        case OwidGdocType.TopicPage:
        case OwidGdocType.LinearTopicPage:
            return {
                type: "topicPage",
                hit: { ...page, excerpt: page.excerpt ?? "" },
            }
        case OwidGdocType.DataInsight:
            return { type: "dataInsight", hit: page }
        default:
            return { type: "article", hit: page }
    }
}
