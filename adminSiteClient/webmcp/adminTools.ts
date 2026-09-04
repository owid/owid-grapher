/**
 * WebMCP tools available on every admin page.
 *
 * These only need the API client: finding indicators, charts and documents,
 * and moving between pages. Anything that acts on what a page is currently
 * showing (the chart editor's unsaved state, the chart list's filter) lives in
 * the page-scoped tool sets, which register and unregister with their page.
 *
 * Every request goes through `admin.requestJSON`, so it carries the user's own
 * session: the agent can do exactly what the person at the keyboard can.
 */
import type { OwidGdocIndexItem } from "@ourworldindata/types"
import type { Admin } from "../Admin.js"
import type { ChartListItem } from "../ChartList.js"
import type { VariableListItem } from "../VariableList.js"
import { filterChartsBySearchString } from "../chartListSearch.js"
import { makeChartConfigForIndicator } from "../indicatorChartConfig.js"
import {
    buildSearchWordsFromSearchString,
    filterFunctionForSearchWords,
} from "../../adminShared/search.js"
import { createCachedList } from "./cachedList.js"
import { navigateTo, navigationBlockedReason } from "./navigation.js"
import {
    activeToolSetNames,
    registerToolSet,
    toolResult,
    type WebMcpTool,
} from "./webmcpTypes.js"

export const ADMIN_TOOL_SET = "admin"
export const DEFAULT_RESULT_LIMIT = 20
export const MAX_RESULT_LIMIT = 50
const LIST_CACHE_MAX_AGE_MS = 5 * 60 * 1000

const chartCache = createCachedList<ChartListItem>({
    maxAgeMs: LIST_CACHE_MAX_AGE_MS,
})
const gdocCache = createCachedList<OwidGdocIndexItem>({
    maxAgeMs: LIST_CACHE_MAX_AGE_MS,
})

/** The charts list page already loads every chart; reuse that payload. */
export const primeChartCache = chartCache.prime
/** Call after creating or saving a chart so `find_charts` sees it. */
export const invalidateChartCache = chartCache.invalidate

export interface AdminToolContext {
    admin: Admin
}

interface IndicatorSearchResponse {
    variables: VariableListItem[]
    numTotalRows: number
}

export interface IndicatorDetails {
    id: number
    name?: string
    unit?: string
    shortUnit?: string
    descriptionShort?: string
    description?: string
    catalogPath?: string
    datasetName?: string
    charts: ChartListItem[]
    grapherConfigETL?: Record<string, unknown>
}

export function clampLimit(limit: unknown): number {
    const n = typeof limit === "number" ? Math.floor(limit) : NaN
    if (!Number.isFinite(n) || n < 1) return DEFAULT_RESULT_LIMIT
    return Math.min(n, MAX_RESULT_LIMIT)
}

export function parseId(value: unknown): number | undefined {
    const n =
        typeof value === "number"
            ? value
            : typeof value === "string" && /^\d+$/.test(value.trim())
              ? Number(value)
              : NaN
    return Number.isInteger(n) && n > 0 ? n : undefined
}

export function describeChart(chart: ChartListItem): string {
    const status = chart.isPublished ? "published" : "draft"
    const type = [
        chart.hasChartTab !== false ? chart.type : undefined,
        chart.hasMapTab ? "Map" : undefined,
    ]
        .filter(Boolean)
        .join("+")
    const tags = chart.tags.map((t) => t.name).join(", ")
    return [
        `#${chart.id}`,
        chart.title ?? "(untitled)",
        type || "no chart type",
        status,
        chart.slug ? `slug: ${chart.slug}` : "no slug",
        tags ? `tags: ${tags}` : undefined,
        `edit: /admin/charts/${chart.id}/edit`,
    ]
        .filter(Boolean)
        .join(" | ")
}

export function describeIndicator(v: VariableListItem): string {
    return [
        `id: ${v.id}`,
        v.name,
        v.dataset ? `dataset: ${v.dataset}` : undefined,
        v.namespace && v.version ? `${v.namespace}/${v.version}` : undefined,
        v.isPrivate ? "private" : undefined,
    ]
        .filter(Boolean)
        .join(" | ")
}

export function describeGdoc(gdoc: OwidGdocIndexItem): string {
    return [
        gdoc.type ?? "unknown type",
        gdoc.title ?? "(untitled)",
        gdoc.published ? "published" : "draft",
        gdoc.slug ? `slug: ${gdoc.slug}` : undefined,
        gdoc.authors?.length ? `by ${gdoc.authors.join(", ")}` : undefined,
        `preview: /admin/gdocs/${gdoc.id}/preview`,
    ]
        .filter(Boolean)
        .join(" | ")
}

export function gdocSearchFields(
    gdoc: OwidGdocIndexItem
): (string | undefined)[] {
    return [
        gdoc.title,
        gdoc.subtitle,
        gdoc.slug,
        gdoc.type,
        gdoc.id,
        ...(gdoc.authors ?? []),
        ...gdoc.tags.map((tag) => tag.name),
    ]
}

export function filterGdocsBySearchString(
    gdocs: OwidGdocIndexItem[],
    search: string | undefined
): OwidGdocIndexItem[] {
    const searchWords = buildSearchWordsFromSearchString(search)
    if (searchWords.length === 0) return gdocs
    return gdocs.filter(
        filterFunctionForSearchWords(searchWords, gdocSearchFields)
    )
}

function listResult<T>(
    label: string,
    matches: T[],
    limit: number,
    describe: (item: T) => string
): string {
    if (matches.length === 0) return `No ${label} match.`
    const shown = matches.slice(0, limit)
    const lines = shown.map(describe)
    const footer =
        matches.length > shown.length
            ? `\n[Showing ${shown.length} of ${matches.length} matching ${label}. Refine the query to see the rest.]`
            : ""
    return `${matches.length} matching ${label}:\n${lines.join("\n")}${footer}`
}

const SEARCH_SYNTAX =
    'Words match in any order; use "quotes" for an exact phrase and -word to exclude.'

/** Undefined when the indicator doesn't exist; never shows the error modal. */
export async function fetchIndicator(
    admin: Admin,
    variableId: number
): Promise<IndicatorDetails | undefined> {
    try {
        const json = await admin.requestJSON<{ variable: IndicatorDetails }>(
            `/api/variables/${variableId}.json`,
            {},
            "GET",
            { onFailure: "continue", isBackground: true }
        )
        return json.variable
    } catch {
        return undefined
    }
}

export function buildAdminTools({ admin }: AdminToolContext): WebMcpTool[] {
    const fetchCharts = (): Promise<ChartListItem[]> =>
        chartCache.get(async () => {
            const json = await admin.getJSONInBackground<{
                charts: ChartListItem[]
            }>("/api/charts.json")
            return json.charts
        })
    const fetchGdocs = (): Promise<OwidGdocIndexItem[]> =>
        gdocCache.get(() =>
            admin.getJSONInBackground<OwidGdocIndexItem[]>("/api/gdocs")
        )

    return [
        {
            name: "where_am_i",
            description:
                "Report which admin page is open and which page-specific " +
                "tools are currently available. Call this first when unsure " +
                "what the user is looking at.",
            inputSchema: { type: "object", properties: {} },
            execute: async () => {
                const path = window.location.pathname + window.location.search
                const sets = activeToolSetNames().filter(
                    (s) => s !== ADMIN_TOOL_SET
                )
                const blocked = navigationBlockedReason()
                return toolResult(
                    [
                        `Current page: ${path}`,
                        sets.length
                            ? `Page-specific tools available: ${sets.join(", ")}.`
                            : "No page-specific tools on this page; the admin-wide tools still work.",
                        blocked ? `Note: ${blocked}` : undefined,
                    ]
                        .filter(Boolean)
                        .join("\n")
                )
            },
        },
        {
            name: "find_indicators",
            description:
                "Search the indicators (variables) in the database by name. " +
                "Returns indicator ids to use with create_chart_from_indicator, " +
                "add_indicators or get_indicator. The query supports regular " +
                "expressions and these fields: name:, path:, namespace:, " +
                "version:, dataset:, table:, short:, is:public, is:private. " +
                "Results are newest datasets first, so add dataset: or a " +
                "distinctive word to narrow a broad query.",
            inputSchema: {
                type: "object",
                properties: {
                    query: {
                        type: "string",
                        description:
                            "e.g. 'life expectancy', 'dataset:un_wpp population'",
                    },
                    limit: {
                        type: "number",
                        description: `Max results, default ${DEFAULT_RESULT_LIMIT}, max ${MAX_RESULT_LIMIT}`,
                    },
                },
                required: ["query"],
            },
            execute: async ({
                query,
                limit,
            }: {
                query: string
                limit?: number
            }) => {
                if (!query?.trim()) return toolResult("Provide a search query.")
                const max = clampLimit(limit)
                const json =
                    await admin.getJSONInBackground<IndicatorSearchResponse>(
                        "/api/variables.json",
                        { search: query, limit: max }
                    )
                if (json.variables.length === 0)
                    return toolResult(
                        `No indicators match "${query}". Try fewer or different words.`
                    )
                const lines = json.variables.map(describeIndicator)
                const footer =
                    json.numTotalRows > json.variables.length
                        ? `\n[Showing ${json.variables.length} of ${json.numTotalRows} matching indicators. Refine the query to see the rest.]`
                        : ""
                return toolResult(
                    `${json.numTotalRows} matching indicators:\n${lines.join("\n")}${footer}`
                )
            },
        },
        {
            name: "get_indicator",
            description:
                "Get an indicator's metadata (name, unit, description, " +
                "dataset, catalog path) and the charts that already use it. " +
                "Use it to check an indicator before building a chart on it.",
            inputSchema: {
                type: "object",
                properties: {
                    variableId: {
                        type: "number",
                        description: "Indicator id from find_indicators",
                    },
                },
                required: ["variableId"],
            },
            execute: async ({ variableId }: { variableId: number }) => {
                const id = parseId(variableId)
                if (!id)
                    return toolResult("variableId must be a positive integer.")
                const v = await fetchIndicator(admin, id)
                if (!v) return toolResult(`No indicator with id ${id} exists.`)
                const description = (v.descriptionShort ?? v.description ?? "")
                    .trim()
                    .slice(0, 600)
                const charts = v.charts ?? []
                return toolResult(
                    [
                        `Indicator ${v.id}: ${v.name ?? "(unnamed)"}`,
                        v.unit ? `Unit: ${v.unit}` : undefined,
                        v.datasetName ? `Dataset: ${v.datasetName}` : undefined,
                        v.catalogPath
                            ? `Catalog path: ${v.catalogPath}`
                            : undefined,
                        description ? `Description: ${description}` : undefined,
                        v.grapherConfigETL
                            ? "Has an indicator-level grapher config (new charts inherit it)."
                            : "No indicator-level grapher config.",
                        charts.length
                            ? `Used by ${charts.length} chart(s):\n${charts
                                  .slice(0, DEFAULT_RESULT_LIMIT)
                                  .map(describeChart)
                                  .join("\n")}`
                            : "Not used by any chart yet.",
                        `Admin page: /admin/variables/${v.id}`,
                    ]
                        .filter(Boolean)
                        .join("\n")
                )
            },
        },
        {
            name: "find_charts",
            description:
                "Search all charts in the admin (published and drafts) by " +
                "title, slug, id, chart type, tag, internal notes or editor " +
                `name. ${SEARCH_SYNTAX} Returns chart ids for ` +
                "open_chart_editor.",
            inputSchema: {
                type: "object",
                properties: {
                    query: { type: "string" },
                    limit: {
                        type: "number",
                        description: `Max results, default ${DEFAULT_RESULT_LIMIT}, max ${MAX_RESULT_LIMIT}`,
                    },
                },
                required: ["query"],
            },
            execute: async ({
                query,
                limit,
            }: {
                query: string
                limit?: number
            }) => {
                if (!query?.trim()) return toolResult("Provide a search query.")
                const charts = await fetchCharts()
                const matches = filterChartsBySearchString(charts, query)
                return toolResult(
                    listResult(
                        "charts",
                        matches,
                        clampLimit(limit),
                        describeChart
                    )
                )
            },
        },
        {
            name: "find_articles",
            description:
                "Search the Google-Docs-authored content (articles, topic " +
                "pages, data insights, fragments) by title, slug, type, " +
                `author or tag. ${SEARCH_SYNTAX}`,
            inputSchema: {
                type: "object",
                properties: {
                    query: { type: "string" },
                    limit: {
                        type: "number",
                        description: `Max results, default ${DEFAULT_RESULT_LIMIT}, max ${MAX_RESULT_LIMIT}`,
                    },
                },
                required: ["query"],
            },
            execute: async ({
                query,
                limit,
            }: {
                query: string
                limit?: number
            }) => {
                if (!query?.trim()) return toolResult("Provide a search query.")
                const gdocs = await fetchGdocs()
                const matches = filterGdocsBySearchString(gdocs, query)
                return toolResult(
                    listResult(
                        "documents",
                        matches,
                        clampLimit(limit),
                        describeGdoc
                    )
                )
            },
        },
        {
            name: "open_chart_editor",
            description:
                "Open the editor for an existing chart. Once it has loaded, " +
                "the chart editor tools (get_chart_editor_state, " +
                "update_chart_config, save_chart, ...) become available. " +
                "Refused while another editor has unsaved changes.",
            inputSchema: {
                type: "object",
                properties: {
                    chartId: { type: "number" },
                },
                required: ["chartId"],
            },
            execute: async ({ chartId }: { chartId: number }) => {
                const id = parseId(chartId)
                if (!id)
                    return toolResult("chartId must be a positive integer.")
                const result = navigateTo(`/charts/${id}/edit`)
                if (!result.ok)
                    return toolResult(`${result.reason} Nothing was changed.`)
                return toolResult(
                    `Opening the editor for chart ${id} at /admin${result.path}. ` +
                        "Call get_chart_editor_state once it has loaded."
                )
            },
        },
        {
            name: "open_indicator",
            description:
                "Open the admin page of an indicator, showing its metadata, " +
                "sources and the charts using it.",
            inputSchema: {
                type: "object",
                properties: {
                    variableId: { type: "number" },
                },
                required: ["variableId"],
            },
            execute: async ({ variableId }: { variableId: number }) => {
                const id = parseId(variableId)
                if (!id)
                    return toolResult("variableId must be a positive integer.")
                const result = navigateTo(`/variables/${id}`)
                if (!result.ok)
                    return toolResult(`${result.reason} Nothing was changed.`)
                return toolResult(
                    `Opening indicator ${id} at /admin${result.path}.`
                )
            },
        },
        {
            name: "open_charts_list",
            description:
                "Open the charts list page, optionally with a search already " +
                "applied. On that page search_chart_list refines the list.",
            inputSchema: {
                type: "object",
                properties: {
                    search: {
                        type: "string",
                        description: "Optional initial search",
                    },
                },
            },
            execute: async ({ search }: { search?: string }) => {
                const query = search?.trim()
                const result = navigateTo("/charts", {
                    search: query
                        ? `?chartSearch=${encodeURIComponent(query)}`
                        : "",
                })
                if (!result.ok)
                    return toolResult(`${result.reason} Nothing was changed.`)
                return toolResult(
                    `Opening the charts list at /admin${result.path}.`
                )
            },
        },
        {
            name: "create_chart_from_indicator",
            description:
                "Start a new chart for an indicator and open it in the chart " +
                "editor. The chart starts from the indicator's own grapher " +
                "config if it has one, otherwise as a world map of the " +
                "indicator. Nothing is saved until save_chart is called. " +
                "Use find_indicators to get the id. Refused while another " +
                "editor has unsaved changes.",
            inputSchema: {
                type: "object",
                properties: {
                    variableId: {
                        type: "number",
                        description: "Indicator id from find_indicators",
                    },
                },
                required: ["variableId"],
            },
            execute: async ({ variableId }: { variableId: number }) => {
                const id = parseId(variableId)
                if (!id)
                    return toolResult("variableId must be a positive integer.")
                const blocked = navigationBlockedReason()
                if (blocked)
                    return toolResult(`${blocked} Nothing was changed.`)
                const v = await fetchIndicator(admin, id)
                if (!v)
                    return toolResult(
                        `No indicator with id ${id} exists. Nothing was changed.`
                    )
                const config = makeChartConfigForIndicator(
                    id,
                    v.grapherConfigETL
                )
                const result = navigateTo("/charts/create", {
                    search: `?${new URLSearchParams({ config: JSON.stringify(config) })}`,
                })
                if (!result.ok)
                    return toolResult(`${result.reason} Nothing was changed.`)
                return toolResult(
                    `Opening a new chart for indicator ${id} (${v.name ?? "unnamed"}) ` +
                        (v.grapherConfigETL
                            ? "based on its indicator-level config. "
                            : "as a world map. ") +
                        "Once the editor has loaded, use get_chart_editor_state, " +
                        "then add_chart_type, select_entities, update_chart_config " +
                        "and save_chart."
                )
            },
        },
    ]
}

export function registerAdminTools(
    context: AdminToolContext,
    signal: AbortSignal
): Promise<void> {
    return registerToolSet(ADMIN_TOOL_SET, buildAdminTools(context), signal)
}
