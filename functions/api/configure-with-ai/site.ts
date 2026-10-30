// "Across the site": a search tool the model can call to find other pages on
// Our World in Data, and the checks on the pages it then suggests. The search
// is the site's own Algolia search; this file only describes its results to
// the model and checks the reply against them.

import {
    generateSelectedEntityNamesParam,
    mapGrapherTabNameToQueryParam,
} from "@ourworldindata/grapher"
import { ChartRecordType, OwidGdocType } from "@ourworldindata/types"
import { AlgoliaConfig } from "../search/algoliaClient.js"
import {
    EnrichedSearchChartHit,
    EnrichedSearchPageHit,
    searchCharts,
    searchPages,
} from "../search/searchApi.js"
import {
    MAP_REGIONS,
    MAX_PAGES,
    SanitizedReply,
    TIME_PATTERN,
} from "./viewfinder.js"

export type SitePageKind = "chart" | "explorer" | "article" | "topic"

/** A search result the model has seen, by the id it was shown with */
export interface FoundPage {
    kind: SitePageKind
    title: string
    /** The data page a chart variant belongs to, if it's a variant */
    page: string | null
    variant: string | null
    /** Relative URL, with the query params of an explorer or MDim view */
    url: string
    /** Tab query params; [] for writing */
    tabs: string[]
    /** Countries and regions with data; empty for writing */
    entities: string[]
    thumbnailUrl: string | null
}

/** A page the model suggested, as sent to the panel */
export interface SitePageSuggestion {
    kind: SitePageKind
    title: string
    page: string | null
    variant: string | null
    label: string
    why: string
    /** Relative URL with the tab, countries and time the model chose */
    url: string
    tab: string | null
    thumbnailUrl: string | null
}

const CHART_RESULTS = 8
const WRITING_RESULTS = 4
const WRITING_TYPES = [
    OwidGdocType.Article,
    OwidGdocType.TopicPage,
    OwidGdocType.LinearTopicPage,
]

export const SEARCH_TOOL = {
    name: "search_site",
    description:
        "Searches Our World in Data for charts, chart variants and data explorer views (results with ids starting with c) and for articles and topic pages (ids starting with w), by keywords. Pass `countries` the reader mentions to see which charts have data for them (has: true/false). Search again with other words if the results are off.",
    input_schema: {
        type: "object",
        properties: {
            query: {
                type: "string",
                description:
                    'A few keywords, like a reader would type into site search, e.g. "life expectancy gdp"',
            },
            countries: { type: "array", items: { type: "string" } },
        },
        required: ["query"],
    },
}

const shorten = (s: string | undefined, max: number): string | undefined =>
    s && s.length > max ? s.slice(0, max - 1) + "…" : s || undefined

function chartKind(hit: EnrichedSearchChartHit): SitePageKind {
    return hit.type === ChartRecordType.ExplorerView ? "explorer" : "chart"
}

/**
 * The search_site tool for one request. It remembers every result it showed
 * the model, so the reply can only suggest pages that exist, with countries
 * and tabs they have.
 */
export class SiteSearch {
    readonly found = new Map<string, FoundPage>()
    readonly searches: string[] = []
    private nextChart = 1
    private nextWriting = 1

    constructor(private readonly config: AlgoliaConfig) {}

    async run(input: unknown): Promise<unknown> {
        const args = (input && typeof input === "object" ? input : {}) as {
            query?: unknown
            countries?: unknown
        }
        const query = String(args.query ?? "")
            .trim()
            .slice(0, 100)
        if (!query) return { error: "Empty query" }
        const countries = Array.isArray(args.countries)
            ? args.countries.slice(0, 6).map(String)
            : []
        this.searches.push(query)
        const [charts, writing] = await Promise.all([
            searchCharts(
                this.config,
                { query, filters: [], requireAllCountries: false },
                0,
                CHART_RESULTS,
                ""
            ),
            searchPages(
                this.config,
                query,
                0,
                WRITING_RESULTS,
                WRITING_TYPES,
                ""
            ),
        ])
        return {
            charts: charts.results.map((hit) =>
                this.describeChart(hit, countries)
            ),
            writing: writing.results.map((hit) => this.describeWriting(hit)),
        }
    }

    private remember(prefix: "c" | "w", page: FoundPage): string {
        // The same page found again keeps its id
        for (const [id, seen] of this.found)
            if (seen.url === page.url) return id
        const id =
            prefix === "c" ? `c${this.nextChart++}` : `w${this.nextWriting++}`
        this.found.set(id, page)
        return id
    }

    private describeChart(
        hit: EnrichedSearchChartHit,
        countries: string[]
    ): Record<string, unknown> {
        const entities = hit.originalAvailableEntities ?? hit.availableEntities
        const tabs = hit.availableTabs.map(mapGrapherTabNameToQueryParam)
        const kind = chartKind(hit)
        const page = hit.containerTitle ?? null
        const id = this.remember("c", {
            kind,
            title: hit.title,
            page,
            variant: hit.variantName || null,
            url: hit.url,
            tabs,
            entities,
            thumbnailUrl: null,
        })
        return {
            id,
            kind: kind === "explorer" ? "data explorer view" : "chart",
            title: hit.title,
            ...(page && page !== hit.title ? { page } : {}),
            ...(hit.variantName ? { variant: hit.variantName } : {}),
            ...(hit.subtitle ? { subtitle: shorten(hit.subtitle, 160) } : {}),
            tabs,
            countries: entities.length,
            ...(countries.length
                ? {
                      has: Object.fromEntries(
                          countries.map((c) => [
                              c,
                              matchEntity(c, entities) !== undefined,
                          ])
                      ),
                  }
                : {}),
        }
    }

    private describeWriting(
        hit: EnrichedSearchPageHit
    ): Record<string, unknown> {
        const kind: SitePageKind =
            hit.type === OwidGdocType.Article ? "article" : "topic"
        const id = this.remember("w", {
            kind,
            title: hit.title,
            page: null,
            variant: null,
            url: hit.url,
            tabs: [],
            entities: [],
            thumbnailUrl: hit.thumbnailUrl ?? null,
        })
        return {
            id,
            kind: kind === "article" ? "article" : "topic page",
            title: hit.title,
            ...(hit.content ? { excerpt: shorten(hit.content, 160) } : {}),
        }
    }
}

function matchEntity(name: string, entities: string[]): string | undefined {
    const low = name.toLowerCase().trim()
    return entities.find((e) => e.toLowerCase() === low)
}

/** A chart's URL with the tab, countries, time and map region a suggestion asks for */
export function configuredUrl(
    url: string,
    view: {
        tab: string | null
        entities: string[]
        time: string | null
        mapRegion: string | null
    }
): string {
    const parsed = new URL(url, "https://ourworldindata.org")
    if (view.tab) parsed.searchParams.set("tab", view.tab)
    if (view.time) parsed.searchParams.set("time", view.time)
    if (view.mapRegion) parsed.searchParams.set("region", view.mapRegion)
    if (view.entities.length)
        parsed.searchParams.set(
            "country",
            generateSelectedEntityNamesParam(view.entities)
        )
    // Grapher writes the country separator unencoded
    return (parsed.pathname + parsed.search).replace(/%7E/gi, "~")
}

/** Checks the pages the model suggested against what the searches found */
export function sanitizePages(
    raw: unknown,
    found: Map<string, FoundPage>
): { pages: SitePageSuggestion[]; dropped: string[] } {
    const items = Array.isArray(raw) ? raw.slice(0, MAX_PAGES) : []
    const pages: SitePageSuggestion[] = []
    const dropped: string[] = []
    const used = new Set<string>()
    for (const item of items) {
        const s = (item && typeof item === "object" ? item : {}) as Record<
            string,
            unknown
        >
        const hit = found.get(String(s.id))
        if (!hit) {
            dropped.push(`page id ${JSON.stringify(s.id)}`)
            continue
        }
        // Each result once; different views of one explorer or MDim page
        // are different results
        if (used.has(String(s.id))) continue
        used.add(String(s.id))
        const isData = hit.kind === "chart" || hit.kind === "explorer"
        const tab =
            isData && typeof s.tab === "string" && hit.tabs.includes(s.tab)
                ? s.tab
                : null
        if (isData && s.tab && !tab) dropped.push(`tab "${String(s.tab)}"`)
        const entities: string[] = []
        if (isData)
            for (const name of Array.isArray(s.entities) ? s.entities : []) {
                const match = matchEntity(String(name), hit.entities)
                if (match) entities.push(match)
                else dropped.push(`entity "${String(name)}" on ${hit.url}`)
            }
        const time =
            isData &&
            typeof s.time === "string" &&
            TIME_PATTERN.test(s.time.trim())
                ? s.time.trim()
                : null
        // Only a link that opens the map tab zooms
        const mapRegion =
            tab === "map" &&
            typeof s.mapRegion === "string" &&
            MAP_REGIONS.includes(s.mapRegion)
                ? s.mapRegion
                : null
        pages.push({
            kind: hit.kind,
            title: hit.title,
            page: hit.page,
            variant: hit.variant,
            label: String(s.label || hit.title).slice(0, 80),
            why: typeof s.why === "string" ? s.why.trim().slice(0, 200) : "",
            url: isData
                ? configuredUrl(hit.url, { tab, entities, time, mapRegion })
                : hit.url,
            tab,
            thumbnailUrl: hit.thumbnailUrl,
        })
    }
    return { pages, dropped }
}

export interface SiteReply extends SanitizedReply {
    intent: "here" | "elsewhere"
    /** Shown above the pages */
    message: string | null
    pages: SitePageSuggestion[]
}

/**
 * Adds the pages to a site-mode reply. The answer goes by what's left after
 * the checks: pages without views are "elsewhere" whatever the model said,
 * and views without pages "here".
 */
export function sanitizeSiteReply(
    raw: unknown,
    views: SanitizedReply,
    found: Map<string, FoundPage>
): SiteReply {
    const reply = (raw && typeof raw === "object" ? raw : {}) as Record<
        string,
        unknown
    >
    const { pages, dropped } = sanitizePages(reply.pages, found)
    const intent =
        pages.length && (reply.intent === "elsewhere" || !views.views.length)
            ? "elsewhere"
            : "here"
    if (intent === "here")
        return {
            ...views,
            dropped: [...views.dropped, ...dropped],
            intent,
            message: null,
            pages: [],
        }
    return {
        ...views,
        views: [],
        dropped: [...views.dropped, ...dropped],
        intent,
        message:
            typeof reply.message === "string" && reply.message.trim()
                ? reply.message.trim().slice(0, 300)
                : null,
        pages,
    }
}
