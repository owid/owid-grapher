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

const SEARCH_RESULT_LIMIT = 8

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
    entities: string[]
): string => {
    const name = hit.variantName
        ? `${hit.title} (${hit.variantName})`
        : hit.title
    const coverage = !entities.length
        ? ""
        : missing.length
          ? ` — does NOT have: ${missing.join(", ")}`
          : ` — has all requested entities`
    const subtitle = hit.subtitle ? ` ${hit.subtitle}` : ""
    return `slug: ${hit.slug} | ${name}${coverage}\n   ${subtitle}`.trimEnd()
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
                { query, entities = [] }: { query: string; entities?: string[] },
                options
            ) => {
                const hits = await searchCharts(query, options?.signal)
                if (!hits.length)
                    return toolResult(`No charts found for "${query}".`)
                const ranked = rankHitsByEntityCoverage(hits, entities).slice(
                    0,
                    SEARCH_RESULT_LIMIT
                )
                const lines = ranked.map((entry) => describeHit(entry, entities))
                return toolResult(
                    `Charts matching "${query}" (best first — check the titles carefully, ` +
                        `OWID has several similar charts on most topics):\n\n${lines.join("\n")}\n\n` +
                        `Use open_chart with one of these slugs.`
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
    ]
}

export async function registerSiteTools(signal?: AbortSignal): Promise<void> {
    await registerTools(buildSiteTools(), signal)
}
