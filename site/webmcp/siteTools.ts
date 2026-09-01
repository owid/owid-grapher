import {
    type WebMcpTool,
    registerTools,
    toolResult,
    generateSelectedEntityNamesParam,
} from "@ourworldindata/grapher"

/**
 * Site-wide WebMCP tools, registered on every page of ourworldindata.org.
 *
 * `find_chart` exists because chart selection — not chart manipulation — is the
 * step that decides whether an agent gives a useful answer. Searching
 * "infant mortality" surfaces four near-identical child-mortality charts above
 * the actual infant-mortality one, so an agent guessing at slugs will confidently
 * open the wrong chart. Routing it through OWID's own search, and filtering by
 * which charts actually carry the entities the user asked about, is something
 * the agent cannot do for itself.
 *
 * `open_chart` encodes the requested state into the URL rather than relying on
 * tool calls surviving the navigation. WebMCP tools are per-document and the
 * spec has not settled how an agent's task carries across a page load
 * (webmachinelearning/webmcp#262), so the chart arrives already configured and
 * the per-chart tools take over from there.
 */

interface SearchHit {
    title: string
    slug: string
    subtitle?: string
    variantName?: string
    type: string
    url?: string
    availableEntities?: string[]
}

const SEARCH_RESULT_LIMIT = 4

async function searchCharts(
    query: string,
    signal?: AbortSignal
): Promise<SearchHit[]> {
    const url = `/api/search?q=${encodeURIComponent(query)}&hitsPerPage=20`
    const response = await fetch(url, { signal })
    if (!response.ok)
        throw new Error(`Chart search failed with status ${response.status}`)
    const body = await response.json()
    return (body.results ?? []) as SearchHit[]
}

/**
 * Rank hits by how many of the requested entities they carry.
 *
 * Deliberately not a relevance re-ranking: search order is OWID's to own. This
 * only demotes charts that cannot answer the question at all.
 */
export function rankHitsByEntityCoverage(
    hits: SearchHit[],
    entities: string[]
): { hit: SearchHit; missing: string[] }[] {
    const scored = hits.map((hit) => {
        const available = new Set(
            (hit.availableEntities ?? []).map((name) => name.toLowerCase())
        )
        const missing = entities.filter(
            (entity) => !available.has(entity.toLowerCase())
        )
        return { hit, missing }
    })
    // Stable sort: charts covering every requested entity first, original
    // search order preserved within each group.
    return [
        ...scored.filter(({ missing }) => missing.length === 0),
        ...scored.filter(({ missing }) => missing.length > 0),
    ]
}

const describeHit = (
    { hit, missing }: { hit: SearchHit; missing: string[] },
    /**
     * Only annotate coverage when it actually separates the candidates. In the
     * common case every hit carries the requested entities — "Germany" is on
     * almost every chart — and a column of identical "has all requested
     * entities" notes is noise the model has to read past.
     */
    coverageDiscriminates: boolean
): string => {
    const name = hit.variantName
        ? `${hit.title} (${hit.variantName})`
        : hit.title
    const coverage =
        coverageDiscriminates && missing.length
            ? ` — MISSING: ${missing.join(", ")}`
            : ""
    const subtitle = hit.subtitle ? ` ${hit.subtitle}` : ""
    return `slug: ${hit.slug} | ${name}${coverage}\n   ${subtitle}`.trimEnd()
}

/** A slug, not a filename or a URL. `co-emissions-per-capita.png` is the shape
 *  an agent produces when it wants an image, and v1 happily navigated to it. */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/i

export function validateSlug(slug: string): string | undefined {
    if (SLUG_PATTERN.test(slug)) return undefined
    if (/\.(png|svg|csv|json|zip)$/i.test(slug))
        return (
            `"${slug}" is a file, not a chart slug. Drop the extension and use ` +
            `the chart's own tools for images or downloads.`
        )
    return `"${slug}" is not a valid chart slug. Use one returned by find_chart.`
}

export function buildSiteTools(): WebMcpTool[] {
    return [
        {
            name: "find_chart",
            description:
                "Search Our World in Data's charts by topic. Returns candidate " +
                "charts with their slugs. Pass the countries or regions the user " +
                "asked about so charts that lack them are flagged — many OWID " +
                "topics have several similar charts and picking the right one " +
                "matters. Present the options to the user if more than one fits.",
            inputSchema: {
                type: "object",
                properties: {
                    query: {
                        type: "string",
                        description:
                            "Topic to search for, e.g. 'infant mortality' or 'CO2 emissions per capita'",
                    },
                    entities: {
                        type: "array",
                        items: { type: "string" },
                        description:
                            "Optional countries/regions the user cares about, e.g. ['Czechia', 'Slovakia']",
                    },
                },
                required: ["query"],
            },
            execute: async (
                {
                    query,
                    entities = [],
                }: { query: string; entities?: string[] },
                options
            ) => {
                const hits = await searchCharts(query, options?.signal)
                if (!hits.length)
                    return toolResult(`No charts found for "${query}".`)
                const ranked = rankHitsByEntityCoverage(hits, entities).slice(
                    0,
                    SEARCH_RESULT_LIMIT
                )
                const coverageDiscriminates =
                    entities.length > 0 &&
                    ranked.some(({ missing }) => missing.length > 0) &&
                    ranked.some(({ missing }) => missing.length === 0)
                const lines = ranked.map((entry) =>
                    describeHit(entry, coverageDiscriminates)
                )
                return toolResult(
                    `Charts matching "${query}":\n\n${lines.join("\n")}\n\n` +
                        `OWID has several similar charts on most topics and these titles ` +
                        `differ in ways that matter — "child mortality" is not "infant ` +
                        `mortality". If more than one plausibly fits, ask the user which ` +
                        `they meant rather than picking for them. Then use open_chart. ` +
                        `If the user wants to browse rather than see one chart, use open_search.`
                )
            },
        },

        {
            name: "open_chart",
            description:
                "Open an Our World in Data chart, optionally pre-configured with " +
                "specific countries and a time range. Use a slug from find_chart. " +
                "This navigates the page; once it loads, the chart's own tools " +
                "become available for further changes.",
            inputSchema: {
                type: "object",
                properties: {
                    slug: {
                        type: "string",
                        description: "Chart slug, e.g. 'infant-mortality'",
                    },
                    entities: {
                        type: "array",
                        items: { type: "string" },
                        description:
                            "Countries/regions to show, using exact OWID names",
                    },
                    startYear: { type: "number" },
                    endYear: { type: "number" },
                },
                required: ["slug"],
            },
            execute: async ({
                slug,
                entities,
                startYear,
                endYear,
            }: {
                slug: string
                entities?: string[]
                startYear?: number
                endYear?: number
            }) => {
                const slugError = validateSlug(slug)
                if (slugError)
                    return toolResult(`${slugError} Nothing was changed.`)

                // Navigation unloads the page and every tool registered on it,
                // so it is reserved for actually changing chart. Adjusting the
                // chart already on screen belongs to that chart's own tools.
                if (window.location.pathname === `/grapher/${slug}`)
                    return toolResult(
                        `You are already on the "${slug}" chart. Do not navigate — ` +
                            `use this page's own tools (select_entities, add_entities, ` +
                            `set_time_range, set_chart_view) to change what it shows, ` +
                            `and get_chart_state to see what it is showing now.`
                    )

                const params = new URLSearchParams()
                if (entities?.length)
                    params.set(
                        "country",
                        generateSelectedEntityNamesParam(entities)
                    )
                if (startYear !== undefined || endYear !== undefined)
                    params.set(
                        "time",
                        `${startYear ?? "earliest"}..${endYear ?? "latest"}`
                    )
                const query = params.toString()
                const url = `/grapher/${slug}${query ? `?${query}` : ""}`
                window.location.assign(url)
                return toolResult(
                    `Opening ${url}. Once the chart loads, use get_chart_state to see ` +
                        `what it is showing and the chart's tools to adjust it.`
                )
            },
        },
        {
            name: "open_search",
            description:
                "Open Our World in Data's search results page for a topic, so the " +
                "user can browse everything we have on it. Use this when the user " +
                "wants to explore or search a subject rather than see one specific " +
                "chart — 'search for population density', 'what do you have on " +
                "malaria'. Prefer this over picking a single chart for them.",
            inputSchema: {
                type: "object",
                properties: {
                    query: {
                        type: "string",
                        description: "Search terms, e.g. 'population density'",
                    },
                    resultType: {
                        type: "string",
                        enum: ["all", "data", "writing"],
                        description:
                            "'data' for charts and indicators, 'writing' for articles, " +
                            "'all' (default) for both",
                    },
                },
                required: ["query"],
            },
            execute: async ({
                query,
                resultType,
            }: {
                query: string
                resultType?: string
            }) => {
                const params = new URLSearchParams({
                    q: query,
                    resultType: resultType ?? "all",
                })
                const url = `/search?${params.toString()}`
                window.location.assign(url)
                return toolResult(
                    `Opening the search results for "${query}" at ${url}. ` +
                        `The user can browse the results themselves from here.`
                )
            },
        },
    ]
}

export async function registerSiteTools(signal?: AbortSignal): Promise<void> {
    await registerTools(buildSiteTools(), signal)
}
