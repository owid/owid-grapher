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
import {
    ADMIN_PAGES,
    describeAdminPages,
    resolveAdminPath,
} from "./adminPages.js"
import { createCachedList } from "./cachedList.js"
import { navigateTo, navigationBlockedReason } from "./navigation.js"
import {
    ADMIN_TOOL_SET,
    CHART_EDITOR_TOOL_SET,
    CHART_LIST_TOOL_SET,
} from "./toolSets.js"
import {
    activeToolSetNames,
    registerToolSet,
    toolResult,
    toolSetEpoch,
    waitForToolSet,
    type WebMcpTool,
} from "./webmcpTypes.js"

export { ADMIN_TOOL_SET }
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

/**
 * A row of `/api/datasets.json`. The per-dataset endpoint carries every
 * variable, which for a dataset like WHO's GHO is ~19 MB; the index is 480 KB
 * for all of them, so page descriptions use the index plus a capped indicator
 * search rather than the detail endpoint.
 */
interface DatasetListItem {
    id: number
    name: string
    namespace?: string
    shortName?: string
    version?: string
    isPrivate?: boolean
}

/**
 * A row of `/api/multi-dims.json`.
 *
 * Multi-dimensional data pages are their own admin object, not charts, so
 * `find_charts` never finds them: an agent asked for "the mdim about school
 * enrollment" searched the charts for "mdim" and hit an unrelated draft whose
 * internal notes happened to contain the word.
 */
interface MultiDimListItem {
    id: number
    catalogPath: string
    title: string
    slug: string | null
    published: boolean
    /** Configured view combinations, not traffic. */
    mdimViews: number
    /** Grapher page views over the last 14 days. */
    pageviews: number
}

/**
 * The pieces of `grapher/<namespace>/<version>/<dataset>/<table>#<short name>`.
 *
 * `find_indicators` prints, and its `dataset:` field matches, the catalog short
 * name (`energy_ai`), while the indicator's metadata carries the dataset's
 * human title ("Energy and AI"). An agent that searches for the title finds
 * nothing, so anything that names a dataset shows the short name too.
 */
export function parseCatalogPath(catalogPath: string | undefined): {
    namespace?: string
    version?: string
    dataset?: string
    table?: string
} {
    if (!catalogPath?.startsWith("grapher/")) return {}
    const [path] = catalogPath.split("#")
    const [namespace, version, dataset, table] = path
        .slice("grapher/".length)
        .split("/")
    return { namespace, version, dataset, table }
}

export function describeDatasetOfIndicator(v: IndicatorDetails): string {
    const { dataset } = parseCatalogPath(v.catalogPath)
    if (v.datasetName && dataset)
        return `Dataset: ${v.datasetName} (search it with dataset:${dataset})`
    if (dataset) return `Dataset: ${dataset}`
    return v.datasetName ? `Dataset: ${v.datasetName}` : ""
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

export function describeMultiDim(mdim: MultiDimListItem): string {
    return [
        `#${mdim.id}`,
        mdim.title || "(untitled)",
        mdim.published ? "published" : "draft",
        mdim.slug ? `slug: ${mdim.slug}` : "no slug",
        `${mdim.mdimViews} view combinations`,
        mdim.catalogPath ? `catalog: ${mdim.catalogPath}` : undefined,
        `edit: /admin/multi-dims/${mdim.id}`,
    ]
        .filter(Boolean)
        .join(" | ")
}

export function multiDimSearchFields(
    mdim: MultiDimListItem
): (string | undefined)[] {
    return [
        mdim.title,
        mdim.slug ?? undefined,
        mdim.catalogPath,
        String(mdim.id),
    ]
}

export function filterMultiDimsBySearchString(
    mdims: MultiDimListItem[],
    search: string | undefined
): MultiDimListItem[] {
    const searchWords = buildSearchWordsFromSearchString(search)
    if (searchWords.length === 0) return mdims
    return mdims.filter(
        filterFunctionForSearchWords(searchWords, multiDimSearchFields)
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

const datasetCache = createCachedList<DatasetListItem>({
    maxAgeMs: LIST_CACHE_MAX_AGE_MS,
})

const multiDimCache = createCachedList<MultiDimListItem>({
    maxAgeMs: LIST_CACHE_MAX_AGE_MS,
})

async function fetchMultiDims(admin: Admin): Promise<MultiDimListItem[]> {
    return multiDimCache.get(async () => {
        const json = await admin.getJSONInBackground<{
            multiDims: MultiDimListItem[]
        }>("/api/multi-dims.json")
        return json.multiDims
    })
}

async function fetchDataset(
    admin: Admin,
    datasetId: number
): Promise<DatasetListItem | undefined> {
    try {
        const datasets = await datasetCache.get(async () => {
            const json = await admin.getJSONInBackground<{
                datasets: DatasetListItem[]
            }>("/api/datasets.json")
            return json.datasets
        })
        return datasets.find((d) => d.id === datasetId)
    } catch {
        return undefined
    }
}

/** The indicators of a dataset, by catalog path, capped so the reply stays readable. */
async function fetchDatasetIndicators(
    admin: Admin,
    catalogPath: string
): Promise<{ variables: VariableListItem[]; numTotalRows: number }> {
    try {
        return await admin.getJSONInBackground<IndicatorSearchResponse>(
            "/api/variables.json",
            { search: `path:${catalogPath}`, limit: MAX_RESULT_LIMIT }
        )
    } catch {
        return { variables: [], numTotalRows: 0 }
    }
}

/**
 * What the user is looking at, in enough detail to resolve "this dataset" or
 * "the indicator I have open" without them repeating it.
 *
 * On a dataset page this lists the indicator ids, which is the thing an agent
 * otherwise has to go hunting for before it can build anything.
 */
export async function describeCurrentPage(admin: Admin): Promise<string> {
    const path = window.location.pathname.replace(/^\/admin/, "") || "/"

    const chartEdit = /^\/charts\/(\d+)\/edit/.exec(path)
    if (chartEdit) return `The chart editor, editing chart #${chartEdit[1]}.`
    if (path.startsWith("/charts/create"))
        return "The chart editor, with a new chart that has not been saved yet."
    if (path === "/charts" || path.startsWith("/charts?"))
        return "The charts list."

    const variablePage = /^\/variables\/(\d+)/.exec(path)
    if (variablePage) {
        const id = Number(variablePage[1])
        const v = await fetchIndicator(admin, id)
        if (!v) return `The admin page of indicator ${id}.`
        return [
            `The admin page of indicator ${id}: ${v.name ?? "(unnamed)"}.`,
            describeDatasetOfIndicator(v),
            `Use variableId ${id} with create_chart_from_indicator or add_indicators.`,
        ]
            .filter(Boolean)
            .join("\n")
    }

    const datasetPage = /^\/datasets\/(\d+)/.exec(path)
    if (datasetPage) {
        const id = Number(datasetPage[1])
        const dataset = await fetchDataset(admin, id)
        if (!dataset) return `The admin page of dataset ${id}.`
        const catalogPath = [
            dataset.namespace,
            dataset.version,
            dataset.shortName,
        ]
            .filter(Boolean)
            .join("/")
        const header = `The admin page of dataset ${id}: ${dataset.name}${
            catalogPath ? ` (${catalogPath})` : ""
        }.`
        if (!catalogPath) return header

        const { variables, numTotalRows } = await fetchDatasetIndicators(
            admin,
            catalogPath
        )
        if (!variables.length)
            return `${header}\nFind its indicators with find_indicators path:${catalogPath}.`
        const shown = variables.slice(0, DEFAULT_RESULT_LIMIT)
        const lines = shown.map((v) => `  ${v.id} | ${v.name}`)
        const footer =
            numTotalRows > shown.length
                ? `\n  [${shown.length} of ${numTotalRows} shown; get the rest with find_indicators path:${catalogPath}]`
                : ""
        return (
            `${header}\nIts indicators, usable directly with ` +
            `create_chart_from_indicator or add_indicators:\n${lines.join("\n")}${footer}`
        )
    }

    const multiDimPage = /^\/multi-dims\/(\d+)/.exec(path)
    if (multiDimPage) {
        const id = Number(multiDimPage[1])
        const mdim = (await fetchMultiDims(admin).catch(() => [])).find(
            (m) => m.id === id
        )
        if (!mdim)
            return `The editor of multi-dimensional data page (mdim) ${id}.`
        return (
            `The editor of multi-dimensional data page (mdim) ${id}: ` +
            `${mdim.title || "(untitled)"}, ${
                mdim.published ? "published" : "draft"
            }, with ${mdim.mdimViews} view combinations` +
            `${mdim.catalogPath ? ` (${mdim.catalogPath})` : ""}. ` +
            "There are no tools for editing mdims yet."
        )
    }

    const gdocPage = /^\/gdocs\/([^/]+)/.exec(path)
    if (gdocPage) return `The preview of Google Doc ${gdocPage[1]}.`
    if (path.startsWith("/variables")) return "The indicators list."
    if (path.startsWith("/datasets")) return "The datasets list."
    if (path.startsWith("/gdocs")) return "The list of Google Docs."

    const listPage = ADMIN_PAGES.find((page) => page.path === path)
    if (listPage)
        return `The ${listPage.summary.toLowerCase()} page (${listPage.path}).`

    return `An admin page at ${path}.`
}

/**
 * Navigate, then wait for the destination page's tools to register, so an
 * agent's next call lands on a page that can serve it. Without this the agent
 * reliably calls an editor tool a second too early and gets a browser-level
 * "not of type 'RegisteredTool'" error it can't interpret.
 */
async function navigateAndWaitForToolSet(
    path: string,
    { search, toolSet }: { search?: string; toolSet: string }
): Promise<
    { ok: false; reason: string } | { ok: true; path: string; ready: boolean }
> {
    const epochBefore = toolSetEpoch(toolSet)
    const result = navigateTo(path, { search })
    if (!result.ok) return result
    // Staying put registers nothing, so waiting for an epoch newer than the
    // one we already saw would hang until the timeout. What the caller needs
    // to know is only whether the tools are there.
    if (result.unchanged)
        return { ok: true, path: result.path, ready: epochBefore > 0 }
    const ready = await waitForToolSet(toolSet, { afterEpoch: epochBefore })
    return { ok: true, path: result.path, ready }
}

const STILL_LOADING =
    "The page is taking a while to load; wait a moment and call where_am_i to check."

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
                "Describe the admin page the user is looking at, including " +
                "what it is about: on an indicator or dataset page it names " +
                "them and gives the indicator ids to build charts from. " +
                "ALWAYS call this before acting on a request that says " +
                '"this", "here", "the one I have open" or similar, and ' +
                "whenever you are unsure what the user means. Also reports " +
                "which page-specific tools exist right now.",
            inputSchema: { type: "object", properties: {} },
            execute: async () => {
                const path = window.location.pathname + window.location.search
                const sets = activeToolSetNames().filter(
                    (s) => s !== ADMIN_TOOL_SET
                )
                const blocked = navigationBlockedReason()
                return toolResult(
                    [
                        await describeCurrentPage(admin),
                        `URL path: ${path}`,
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
                "dataset: and path: match the catalog short names shown in " +
                "the results (dataset:energy_ai, " +
                "path:energy/2026-06-30/energy_ai), never the dataset's " +
                "human title. Results are newest datasets first, so add " +
                "dataset: or a distinctive word to narrow a broad query.",
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
                        describeDatasetOfIndicator(v) || undefined,
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
            name: "find_multi_dims",
            description:
                "Search the multi-dimensional data pages, called mdims or " +
                "MDIMs, by title, slug or catalog path. These are not " +
                "charts and find_charts never returns them: an mdim is one " +
                "page whose dropdowns switch between many configured views. " +
                `${SEARCH_SYNTAX} Returns ids for open_multi_dim.`,
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
                const mdims = await fetchMultiDims(admin)
                const matches = filterMultiDimsBySearchString(mdims, query)
                return toolResult(
                    listResult(
                        "multi-dimensional data pages",
                        matches,
                        clampLimit(limit),
                        describeMultiDim
                    )
                )
            },
        },
        {
            name: "open_chart_editor",
            description:
                "Open the editor for an existing chart. Returns once the " +
                "chart editor tools (get_chart_editor_state, " +
                "update_chart_config, save_chart, ...) are available, so you " +
                "can call them straight away. Refused while another editor " +
                "has unsaved changes.",
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
                const result = await navigateAndWaitForToolSet(
                    `/charts/${id}/edit`,
                    { toolSet: CHART_EDITOR_TOOL_SET }
                )
                if (!result.ok)
                    return toolResult(`${result.reason} Nothing was changed.`)
                if (!result.ready)
                    return toolResult(
                        `Opened chart ${id} at /admin${result.path}. ${STILL_LOADING}`
                    )
                return toolResult(
                    `The editor for chart ${id} is open at /admin${result.path} ` +
                        "and its tools are ready."
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
                    `Opening indicator ${id} at /admin${result.path}. ` +
                        "This page has no tools of its own; get_indicator " +
                        "reads the same information."
                )
            },
        },
        {
            name: "open_multi_dim",
            description:
                "Open the editor of a multi-dimensional data page (mdim). " +
                "Use find_multi_dims to get the id. The page has no tools of " +
                "its own yet, so this shows it to the user rather than " +
                "making it editable.",
            inputSchema: {
                type: "object",
                properties: {
                    multiDimId: {
                        type: "number",
                        description: "Mdim id from find_multi_dims",
                    },
                },
                required: ["multiDimId"],
            },
            execute: async ({ multiDimId }: { multiDimId: number }) => {
                const id = parseId(multiDimId)
                if (!id)
                    return toolResult("multiDimId must be a positive integer.")
                const mdims = await fetchMultiDims(admin).catch(() => [])
                const mdim = mdims.find((m) => m.id === id)
                if (mdims.length && !mdim)
                    return toolResult(
                        `No multi-dimensional data page with id ${id} exists. Nothing was changed.`
                    )
                const result = navigateTo(`/multi-dims/${id}`)
                if (!result.ok)
                    return toolResult(`${result.reason} Nothing was changed.`)
                return toolResult(
                    `Opening mdim ${id}${mdim ? ` (${mdim.title})` : ""} at /admin${result.path}.`
                )
            },
        },
        {
            name: "open_admin_page",
            description:
                "Open any other admin page by path or name, for the many " +
                "pages that have no tool of their own: " +
                `${describeAdminPages()}. ` +
                "Detail pages work too, e.g. /multi-dims/2713 or " +
                "/gdocs/<id>/preview. An unknown path is refused rather " +
                "than opened, so the user does not lose their page. This " +
                "only navigates; it cannot type into the page's own search " +
                "box unless that page has tools of its own.",
            inputSchema: {
                type: "object",
                properties: {
                    page: {
                        type: "string",
                        description:
                            'An admin path or page name, e.g. "/data-insights", "data insights" or "/multi-dims/2713"',
                    },
                },
                required: ["page"],
            },
            execute: async ({ page }: { page: string }) => {
                if (typeof page !== "string" || !page.trim())
                    return toolResult("Provide an admin page path or name.")
                const target = resolveAdminPath(page)
                if (!target.ok)
                    return toolResult(
                        `"${page}" is not an admin page.` +
                            (target.candidates.length
                                ? ` Did you mean: ${target.candidates.join(", ")}?`
                                : ` Available pages: ${describeAdminPages()}.`) +
                            " Nothing was changed."
                    )
                const toolSet = /^\/charts\/(\d+\/edit|create)$/.test(
                    target.path
                )
                    ? CHART_EDITOR_TOOL_SET
                    : target.path === "/charts"
                      ? CHART_LIST_TOOL_SET
                      : undefined
                const result = toolSet
                    ? await navigateAndWaitForToolSet(target.path, {
                          search: target.search,
                          toolSet,
                      })
                    : navigateTo(target.path, { search: target.search })
                if (!result.ok)
                    return toolResult(`${result.reason} Nothing was changed.`)
                const opened = `Opened /admin${result.path}${target.search}. `
                if (toolSet)
                    return toolResult(
                        "ready" in result && result.ready
                            ? `${opened}Its tools (${toolSet}) are ready.`
                            : `${opened}${STILL_LOADING}`
                    )
                return toolResult(
                    `${opened}Call where_am_i for what it shows. This page ` +
                        "has no tools of its own, so the user drives it from here."
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
                const result = await navigateAndWaitForToolSet("/charts", {
                    search: query
                        ? `?chartSearch=${encodeURIComponent(query)}`
                        : "",
                    toolSet: CHART_LIST_TOOL_SET,
                })
                if (!result.ok)
                    return toolResult(`${result.reason} Nothing was changed.`)
                if (!result.ready)
                    return toolResult(
                        `Opened the charts list at /admin${result.path}. ${STILL_LOADING}`
                    )
                return toolResult(
                    `The charts list is open at /admin${result.path}; ` +
                        "search_chart_list refines it from here."
                )
            },
        },
        {
            name: "create_chart_from_indicator",
            description:
                "Start a new chart for an indicator and open it in the chart " +
                "editor. The chart starts from the indicator's own grapher " +
                "config if it has one, otherwise as a world map of the " +
                "indicator. Returns once the editor's tools are ready. " +
                "Nothing is saved until save_chart is called. Use " +
                "find_indicators to get the id. This is also the right way " +
                "to build a chart on a different topic than the one already " +
                "open: it starts clean, where emptying an existing chart " +
                "would keep its title, entity selection and axis settings. " +
                "Refused while another editor has unsaved changes.",
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
                const result = await navigateAndWaitForToolSet(
                    "/charts/create",
                    {
                        search: `?${new URLSearchParams({ config: JSON.stringify(config) })}`,
                        toolSet: CHART_EDITOR_TOOL_SET,
                    }
                )
                if (!result.ok)
                    return toolResult(`${result.reason} Nothing was changed.`)
                const opened =
                    `A new chart for indicator ${id} (${v.name ?? "unnamed"}) is open ` +
                    (v.grapherConfigETL
                        ? "based on its indicator-level config. "
                        : "as a world map. ")
                if (!result.ready)
                    return toolResult(`${opened}${STILL_LOADING}`)
                return toolResult(
                    `${opened}The editor's tools are ready: use ` +
                        "get_chart_editor_state, then add_chart_type, " +
                        "select_entities, update_chart_config and save_chart."
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
