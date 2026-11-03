import {
    AI_SEARCH_EFFORTS,
    AI_SEARCH_MODELS,
    AI_SEARCH_POOL_SIZES,
    AiSearchAngle,
    AiSearchChartCandidate,
    AiSearchGroup,
    AiSearchPageCandidate,
    AiSearchSettings,
    AiSearchEvent,
    AiSearchInput,
    AiSearchIntent,
    AiSearchCurated,
    AiSearchLayout,
    AiSearchMode,
    AI_SEARCH_INTENTS,
    AI_SEARCH_MODES,
    DEFAULT_AI_SEARCH_SETTINGS,
    GRAPHER_TAB_NAMES,
    GrapherTabName,
    OwidGdocType,
} from "@ourworldindata/types"

export const MAX_QUERY_LENGTH = 200
const MAX_EXPANSION_QUERIES = 6

const pick = <T extends string | number>(
    allowed: readonly T[],
    value: string | null,
    fallback: T
): T => allowed.find((option) => String(option) === value) ?? fallback

/** Reads the prototype settings from the query string, ignoring bad values. */
export function parseAiSearchSettings(
    params: URLSearchParams
): AiSearchSettings {
    const d = DEFAULT_AI_SEARCH_SETTINGS
    const flag = (name: string, fallback: boolean): boolean =>
        params.has(name) ? params.get(name) === "1" : fallback
    return {
        model: pick(AI_SEARCH_MODELS, params.get("model"), d.model),
        effort: pick(AI_SEARCH_EFFORTS, params.get("effort"), d.effort),
        expand: flag("expand", d.expand),
        pool: pick(AI_SEARCH_POOL_SIZES, params.get("pool"), d.pool),
        debug: flag("debug", d.debug),
    }
}

export type ChartHitWithoutId = Omit<AiSearchChartCandidate, "id">
export type PageHitWithoutId = Omit<AiSearchPageCandidate, "id"> & {
    excerpt?: string
}

export interface RankedHits {
    charts: ChartHitWithoutId[]
    pages: PageHitWithoutId[]
}

export interface CandidatePool {
    charts: AiSearchChartCandidate[]
    pages: (AiSearchPageCandidate & { excerpt?: string })[]
}

const chartKey = (hit: ChartHitWithoutId): string =>
    `${hit.slug}${hit.queryParams ?? ""}`

/**
 * Interleaves the original search with the expansion searches so that each
 * angle gets a share of the pool: per rank, three hits from the original
 * search and one from each expansion. Duplicates keep their first position.
 * Candidates get short numeric ids, which keep the prompt small.
 */
export function buildCandidatePool(
    lists: RankedHits[],
    {
        charts: chartPoolSize,
        pages: pagePoolSize,
    }: { charts: number; pages: number }
): CandidatePool {
    const charts: AiSearchChartCandidate[] = []
    const pages: CandidatePool["pages"] = []
    const seenCharts = new Set<string>()
    const seenPages = new Set<string>()
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
                if (
                    chart &&
                    charts.length < chartPoolSize &&
                    !seenCharts.has(chartKey(chart))
                ) {
                    seenCharts.add(chartKey(chart))
                    charts.push({ ...chart, id: nextId++ })
                }
                const page = list.pages[position]
                if (
                    page &&
                    pages.length < pagePoolSize &&
                    !seenPages.has(`${page.type}/${page.slug}`)
                ) {
                    seenPages.add(`${page.type}/${page.slug}`)
                    pages.push({ ...page, id: nextId++ })
                }
            }
        }
    }
    return { charts, pages }
}

// The views the model can pick, and the tab each one opens.
const VIEW_TABS: Record<string, GrapherTabName[]> = {
    map: [GRAPHER_TAB_NAMES.WorldMap],
    line: [GRAPHER_TAB_NAMES.LineChart],
    bar: [GRAPHER_TAB_NAMES.DiscreteBar, GRAPHER_TAB_NAMES.StackedDiscreteBar],
    scatter: [GRAPHER_TAB_NAMES.ScatterPlot],
    area: [GRAPHER_TAB_NAMES.StackedArea],
}

const TAB_VIEW_LABELS: Partial<Record<GrapherTabName, string>> = {
    [GRAPHER_TAB_NAMES.LineChart]: "line",
    [GRAPHER_TAB_NAMES.WorldMap]: "map",
    [GRAPHER_TAB_NAMES.DiscreteBar]: "bar",
    [GRAPHER_TAB_NAMES.StackedDiscreteBar]: "bar",
    [GRAPHER_TAB_NAMES.ScatterPlot]: "scatter",
    [GRAPHER_TAB_NAMES.StackedArea]: "area",
    [GRAPHER_TAB_NAMES.SlopeChart]: "slope",
    [GRAPHER_TAB_NAMES.StackedBar]: "stacked-bar",
    [GRAPHER_TAB_NAMES.Marimekko]: "marimekko",
    [GRAPHER_TAB_NAMES.Dumbbell]: "dumbbell",
}

const PAGE_KIND_LABELS: Partial<Record<OwidGdocType, string>> = {
    [OwidGdocType.TopicPage]: "topic page",
    [OwidGdocType.LinearTopicPage]: "topic page",
    [OwidGdocType.DataInsight]: "data insight",
}

const isInsight = (page: AiSearchPageCandidate): boolean =>
    page.type === OwidGdocType.DataInsight

function chartLine(chart: AiSearchChartCandidate): string {
    const views = [
        ...new Set(
            chart.availableTabs
                .map((tab) => TAB_VIEW_LABELS[tab])
                .filter(Boolean)
        ),
    ].join(",")
    const variant = chart.variantName ? ` (${chart.variantName})` : ""
    const keyChart = chart.keyChartForTags?.length ? " | KEY CHART" : ""
    const cited = chart.numRelatedArticles ?? 0
    return `${chart.id} | chart | ${chart.title}${variant} | views: ${views}${keyChart} | cited in ${cited} articles | ${(chart.subtitle ?? "").slice(0, 130)}`
}

function pageLine(page: CandidatePool["pages"][number]): string {
    const kind = PAGE_KIND_LABELS[page.type] ?? "article"
    const byline = [
        (page.authors ?? []).slice(0, 2).join(", "),
        page.date?.slice(0, 4),
    ]
        .filter(Boolean)
        .join(" ")
    return `${page.id} | ${kind} | ${page.title} | ${byline} | ${(page.excerpt ?? "").slice(0, 150)}`
}

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

Suggest up to ${MAX_EXPANSION_QUERIES} additional short keyword searches (2 to 4 words each, using words likely to appear in OWID chart or article titles) that would find content covering the other main angles of this topic: ${angles}. Don't repeat the original search. If the search is already very specific, suggest fewer.`
}

export const PLANNER_SCHEMA = {
    type: "object",
    properties: {
        queries: { type: "array", items: { type: "string" } },
    },
    required: ["queries"],
    additionalProperties: false,
} as const

/** The expansion searches from the planner's JSON answer. */
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

export function composerPrompt(query: string, pool: CandidatePool): string {
    return `You are building the AI-assisted search results page for Our World in Data (OWID), which publishes research and data on the world's largest problems.

A reader searched for: "${query}"

Below is the OWID content our keyword search found that might be relevant. Organise it into a few meaningful groups that reflect how this topic really breaks down, so the reader sees the shape of what OWID has and can jump to the right place. Think like an OWID researcher showing a curious reader around: what are the main questions people have about this topic, and which of our charts and articles answer each one?

Typical angles. Use only the ones the content supports, and use better ones when the topic calls for it:
- today: how countries compare right now (maps and bar charts work well)
- history: how it has changed over the long run (long historical series, line charts)
- breakdown: by age, sex, cause, income group, region and so on
- correlates: how it relates to income, spending, education and other factors (scatter plots)
- other: causes, consequences, policies, projections, measurement

Rules:
- 3 to 6 groups, most useful first. The first group answers the most likely intent behind the search.
- Each group has 2 to 4 charts, best first. Add up to 2 articles or topic pages and up to 1 data insight to a group only when they clearly fit it. Put the main topic page, if there is one, in the first group.
- Use only ids from the list, and never use the same id twice.
- When charts are otherwise equal, prefer KEY CHARTs and charts cited in many articles. Prefer the headline chart over niche variants, and avoid near-duplicates in a group unless the difference is the point of the group.
- Pick a view for each chart that suits its group, only from the views that chart lists: "map" for comparing countries today, "line" for trends, "scatter" for correlates, "bar" for rankings, "area" for how a total splits into parts, or "default".
- Group titles: plain language, sentence case, at most 6 words, saying what the reader will learn (e.g. "How life expectancy has changed").
- Blurbs: one sentence of at most 25 words saying what the group shows. Don't state numbers or findings that aren't in the titles and descriptions below: this orients the reader, it doesn't answer the question.
- If the search is a country, a vague word or something OWID covers only indirectly, build the groups from the closest content we have. Don't comment on what OWID lacks.

Output format: JSON Lines, one JSON object per line, nothing else (no code fences, no commentary).
One line per group: {"type":"group","angle":"today|history|breakdown|correlates|other","title":"...","blurb":"...","charts":[{"id":123,"view":"map"}],"articles":[456],"insights":[789]}
Last line: {"type":"related","queries":["<3 to 5 related searches the reader might try next>"]}

Content (id | type | title | details):
${[...pool.charts.map(chartLine), ...pool.pages.map(pageLine)].join("\n")}`
}

const ANGLES: readonly AiSearchAngle[] = [
    "today",
    "history",
    "breakdown",
    "correlates",
    "other",
]

export type ComposerLine = Extract<AiSearchEvent, { type: "group" | "related" }>

/**
 * Returns a parser for the lines of the composer's JSON Lines output. Each
 * line becomes an event, keeping only ids that are in the pool and haven't
 * been used by an earlier group (the model is told not to repeat ids, but
 * isn't guaranteed to comply). Lines that aren't a usable group or related
 * list give null.
 */
export function createComposerLineParser(
    pool: CandidatePool
): (rawLine: string) => ComposerLine | null {
    const chartsById = new Map(pool.charts.map((chart) => [chart.id, chart]))
    const pagesById = new Map(pool.pages.map((page) => [page.id, page]))
    const usedIds = new Set<number>()
    return (rawLine) =>
        parseComposerLine(rawLine, chartsById, pagesById, usedIds)
}

function parseComposerLine(
    rawLine: string,
    chartsById: Map<number, AiSearchChartCandidate>,
    pagesById: Map<number, AiSearchPageCandidate>,
    usedIds: Set<number>
): ComposerLine | null {
    const line = rawLine
        .trim()
        .replace(/^```(json)?/, "")
        .replace(/```$/, "")
        .trim()
    if (!line.startsWith("{")) return null
    let obj: Record<string, unknown>
    try {
        obj = JSON.parse(line)
    } catch {
        return null
    }

    if (obj.type === "related") {
        const queries = Array.isArray(obj.queries)
            ? obj.queries.filter((q): q is string => typeof q === "string")
            : []
        return { type: "related", queries: queries.slice(0, 5) }
    }
    if (obj.type !== "group") return null

    const claim = (id: number): boolean => {
        if (usedIds.has(id)) return false
        usedIds.add(id)
        return true
    }

    const charts: AiSearchGroup["charts"] = []
    for (const entry of Array.isArray(obj.charts) ? obj.charts : []) {
        const id = Number(typeof entry === "object" ? entry?.id : entry)
        const chart = chartsById.get(id)
        if (!chart || !claim(id)) continue
        const view = typeof entry === "object" ? String(entry?.view) : ""
        const tab = VIEW_TABS[view]?.find((t) =>
            chart.availableTabs.includes(t)
        )
        charts.push(tab ? { id, tab } : { id })
    }

    const pageIds = (value: unknown, wantInsights: boolean): number[] =>
        (Array.isArray(value) ? value : []).map(Number).filter((id) => {
            const page = pagesById.get(id)
            return page && isInsight(page) === wantInsights && claim(id)
        })

    const articles = pageIds(obj.articles, false)
    const insights = pageIds(obj.insights, true)
    if (!charts.length && !articles.length && !insights.length) return null

    return {
        type: "group",
        angle: ANGLES.includes(obj.angle as AiSearchAngle)
            ? (obj.angle as AiSearchAngle)
            : "other",
        title: String(obj.title ?? ""),
        blurb: String(obj.blurb ?? ""),
        charts,
        articles,
        insights,
    }
}

/** The search as the model should read it: the text plus any filters. */
export function describeSearch(input: AiSearchInput): string {
    const parts = [
        input.query ? `"${input.query}"` : "",
        input.countries.length
            ? `country filter: ${input.countries.join(", ")}`
            : "",
        input.topics.length ? `topic filter: ${input.topics.join(", ")}` : "",
    ].filter(Boolean)
    return parts.join(" with ")
}

/** The words to run the keyword search with when there is no text. */
export const keywordQueryFor = (input: AiSearchInput): string =>
    input.query || input.topics.join(" ") || input.countries.join(" ")

const LAYOUT_CHARTS = 40
const LAYOUT_PAGES = 20

export function layoutPrompt(
    input: AiSearchInput,
    pool: CandidatePool
): string {
    const topicPages = pool.pages.filter(
        (page) =>
            page.type === OwidGdocType.TopicPage ||
            page.type === OwidGdocType.LinearTopicPage
    )
    return `You are choosing how to lay out the results of a search on Our World in Data (OWID).

The reader searched for: ${describeSearch(input)}
(Our search box turns country names into a country filter and autocomplete picks into a topic filter.)

The results page can take three shapes, and the reader can switch between them. Pick the one that fits this search best as "mode":
- "targeted": the reader is after one specific thing. We put our best guess up front, with close alternatives next to it. Fits a named measure ("gdp", "life expectancy"), a specific indicator ("crude birth rate"), a measure for a place ("gdp" + United States), a ranking, a relationship between two measures.
- "explore": the reader is browsing a subject. We show the range of what we have, organised to show the different ways in. Fits broad areas ("education", "health", topic Energy and environment), vague words, explanations of a concept.
- "curated": the reader would be best served by what OWID recommends: the key metrics our researchers picked and our profile pages. Fits a country on its own, and a country with a broad topic.

Also pick the "intent":
- "family": a measure or narrow subject that comes in several versions (total vs per person, sources, spans), no country.
- "place": a measure for a specific country or region.
- "exact": one specific, unambiguous indicator, no country.
- "topic": a broad area that covers many measures.
- "country_topic": no text, a country filter and a topic filter.
- "country": a country filter on its own.
- "other": anything else.

Then, whenever one chart could be a good best guess (whatever the mode):
- lead: the id of that chart. Prefer KEY CHARTs and the headline version (e.g. for "gdp", total GDP adjusted for inflation; for "population", the long-run population chart). Use only chart ids from the list.
- view: "line", "map", "bar" or "default", from the views the lead chart lists. Use "line" when entities are selected.
- entities: what to select on the lead chart.
  - family or topic: "World" and the continents "Africa", "Asia", "Europe", "North America", "South America", "Oceania".
  - exact or other: "World" and 4 countries that show the range (e.g. a high, a low and two large countries).
  - place: the country first, then 2 or 3 meaningful comparisons (its region, "World", or peer countries).
  - country_topic or country: the country first, then 2 or 3 peers it is usually discussed against (e.g. other high-income countries for the US), then "World".
- versions: up to 4 other chart ids: other versions of the same measure (per capita, growth, long-run, another source), or the indicators most often looked up alongside it.
- country: the country the search is about, if any. Otherwise "".
- note: one short plain sentence for the reader, at most 20 words, saying how the search was read, e.g. "“GDP” usually means total economic output. Other versions are below." No numbers.
- topic_pages: up to 3 topic page ids from the list, most central first.

Charts (id | title | views | details):
${pool.charts.slice(0, LAYOUT_CHARTS).map(chartLine).join("\n")}

Topic pages (id | title):
${topicPages
    .slice(0, LAYOUT_PAGES)
    .map((page) => `${page.id} | ${page.title}`)
    .join("\n")}`
}

export const LAYOUT_SCHEMA = {
    type: "object",
    properties: {
        mode: { type: "string", enum: [...AI_SEARCH_MODES] },
        intent: { type: "string", enum: [...AI_SEARCH_INTENTS] },
        lead: { type: "integer" },
        view: { type: "string", enum: ["line", "map", "bar", "default"] },
        entities: { type: "array", items: { type: "string" } },
        versions: { type: "array", items: { type: "integer" } },
        country: { type: "string" },
        note: { type: "string" },
        topic_pages: { type: "array", items: { type: "integer" } },
    },
    required: ["mode", "intent"],
    additionalProperties: false,
} as const

const isTopicPage = (page: AiSearchPageCandidate): boolean =>
    page.type === OwidGdocType.TopicPage ||
    page.type === OwidGdocType.LinearTopicPage

/**
 * Turns the layout model's answer into a layout the page can render, keeping
 * only charts and pages from the pool and entities the lead chart has data
 * for. The filters decide some cases outright: a country on its own opens on
 * OWID's recommendations, a country plus a topic with no text is
 * "country_topic", and a country filter turns a measure into "place". A
 * targeted layout needs a lead chart, so without one it opens on exploring.
 */
export function parseLayoutAnswer(
    text: string,
    input: AiSearchInput,
    pool: CandidatePool,
    knownRegions: string[]
): AiSearchLayout {
    let obj: Record<string, unknown> = {}
    try {
        const parsed = JSON.parse(text)
        if (parsed && typeof parsed === "object") obj = parsed
    } catch {
        // An unreadable answer still gets a layout, from the filters alone
    }

    let intent: AiSearchIntent = AI_SEARCH_INTENTS.includes(
        obj.intent as AiSearchIntent
    )
        ? (obj.intent as AiSearchIntent)
        : "other"
    let mode: AiSearchMode = AI_SEARCH_MODES.includes(obj.mode as AiSearchMode)
        ? (obj.mode as AiSearchMode)
        : "explore"

    const filterCountry = input.countries[0]
    const noText = !input.query
    if (noText && input.countries.length && !input.topics.length) {
        intent = "country"
        mode = "curated"
    } else if (noText && input.countries.length && input.topics.length)
        intent = "country_topic"
    else if (
        filterCountry &&
        (intent === "family" || intent === "exact" || intent === "country")
    )
        intent = "place"

    const topicPages = [
        ...new Set(
            (Array.isArray(obj.topic_pages) ? obj.topic_pages : [])
                .map(Number)
                .filter((id) => {
                    const page = pool.pages.find((p) => p.id === id)
                    return page && isTopicPage(page)
                })
        ),
    ].slice(0, 3)
    const note =
        typeof obj.note === "string" && obj.note.trim()
            ? obj.note.trim()
            : undefined

    const lead = pool.charts.find((chart) => chart.id === Number(obj.lead))
    if (!lead) {
        if (intent === "place" || intent === "country_topic") intent = "other"
        return {
            intent,
            mode: mode === "targeted" ? "explore" : mode,
            note: mode === "targeted" ? undefined : note,
            versions: [],
            country: filterCountry,
            topicPages,
        }
    }

    // Entity names as the lead chart spells them
    const available = lead.availableEntities?.length
        ? lead.availableEntities
        : knownRegions
    const byLowerName = new Map(available.map((n) => [n.toLowerCase(), n]))
    const resolve = (name: unknown): string | undefined =>
        typeof name === "string"
            ? byLowerName.get(name.trim().toLowerCase())
            : undefined

    const country = resolve(filterCountry) ?? resolve(obj.country)
    // A place layout without a place the chart knows is just the indicator
    if ((intent === "place" || intent === "country_topic") && !country)
        intent = "exact"

    const entities = [
        ...new Set(
            [country, ...(Array.isArray(obj.entities) ? obj.entities : [])]
                .map(resolve)
                .filter((name): name is string => !!name)
        ),
    ].slice(0, 7)

    const view = String(obj.view)
    const tab = VIEW_TABS[view]?.find((t) => lead.availableTabs.includes(t))

    const versions = [
        ...new Set(
            (Array.isArray(obj.versions) ? obj.versions : [])
                .map(Number)
                .filter(
                    (id) =>
                        id !== lead.id &&
                        pool.charts.some((chart) => chart.id === id)
                )
        ),
    ].slice(0, 4)

    return {
        intent,
        mode,
        note,
        lead: { id: lead.id, tab, entities },
        versions,
        country,
        topicPages,
    }
}

/**
 * The topics to recommend featured metrics from: the topic filters if any,
 * the core country topics for a country on its own, and otherwise the
 * topics the top keyword hits are key charts for.
 */
export function curatedTopicsFor(
    input: AiSearchInput,
    topCharts: ChartHitWithoutId[],
    coreCountryTopics: string[]
): string[] {
    if (input.topics.length) return input.topics
    if (!input.query && input.countries.length) return coreCountryTopics
    const counts = new Map<string, number>()
    for (const chart of topCharts.slice(0, 15))
        for (const tag of chart.keyChartForTags ?? [])
            counts.set(tag, (counts.get(tag) ?? 0) + 1)
    return [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2)
        .map(([tag]) => tag)
}

/** Gives the curated hits ids that don't clash with the candidate pool. */
export function buildCurated(
    hits: {
        topics: { name: string; charts: ChartHitWithoutId[] }[]
        pages: PageHitWithoutId[]
    },
    firstId: number
): AiSearchCurated {
    let nextId = firstId
    const charts: AiSearchChartCandidate[] = []
    const topics = hits.topics.map(({ name, charts: topicCharts }) => ({
        name,
        charts: topicCharts.map((chart) => {
            const id = nextId++
            charts.push({ ...chart, id })
            return id
        }),
    }))
    const pages = hits.pages.map(({ excerpt: _excerpt, ...page }) => ({
        ...page,
        id: nextId++,
    }))
    return { topics, charts, pages }
}
