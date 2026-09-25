import {
    GRAPHER_TAB_NAMES,
    GrapherTabName,
    OwidColumnDef,
} from "@ourworldindata/types"
import { GrapherState } from "../core/GrapherState.js"
import { WebMcpTool, registerTools, toolResult } from "./webmcpTypes.js"

/** Rows of CSV handed to an agent before we truncate. Keeps a broad selection
 *  from swamping the model's context; agents that want everything get the URL. */
const MAX_DATA_ROWS = 400

/**
 * WebMCP tools for a single Grapher chart.
 *
 * These let a browser-resident agent drive the chart the user is looking at:
 * which entities are shown, over which years, on which tab. The point that no
 * URL can replicate is `get_chart_state` — an agent has to be able to *read*
 * the current selection before it can honour "add Poland".
 *
 * Entity naming is the hard part. OWID entity names are canonical ("Czechia",
 * not "Czech Republic") and differ per chart. Rather than hard-coding synonyms,
 * these tools match deterministically and, when that fails, hand the near
 * misses back so the model can pick. Judgment belongs in the agent, not here.
 */

interface EntityMatch {
    resolved: string[]
    unresolved: { requested: string; candidates: string[] }[]
}

/**
 * Match requested names against what the chart actually offers.
 *
 * Exact, then case-insensitive. Anything else is reported as unresolved with
 * substring candidates attached — we never silently pick one.
 */
export function matchEntities(
    requested: string[],
    available: string[]
): EntityMatch {
    const byLowercase = new Map(
        available.map((name) => [name.toLowerCase(), name])
    )
    const resolved: string[] = []
    const unresolved: EntityMatch["unresolved"] = []

    for (const name of requested) {
        const exact = byLowercase.get(name.toLowerCase())
        if (exact) {
            resolved.push(exact)
            continue
        }
        const needle = name.toLowerCase()
        const candidates = available
            .filter(
                (entity) =>
                    entity.toLowerCase().includes(needle) ||
                    needle.includes(entity.toLowerCase())
            )
            .slice(0, 10)
        unresolved.push({ requested: name, candidates })
    }

    return { resolved, unresolved }
}

const describeUnresolved = (unresolved: EntityMatch["unresolved"]): string =>
    unresolved
        .map(({ requested, candidates }) =>
            candidates.length
                ? `"${requested}" is not an entity on this chart. Did you mean: ${candidates.join(", ")}?`
                : `"${requested}" is not available on this chart.`
        )
        .join(" ")

const describeSelection = (grapherState: GrapherState): string => {
    const selected = grapherState.selection.selectedEntityNames
    return selected.length
        ? `Now showing: ${selected.join(", ")}.`
        : "Nothing is selected; the chart is showing its default view."
}

/**
 * Report the range in years, never in the ±Infinity sentinels that
 * `timelineHandleTimeBounds` holds when the chart is at its default extent.
 * An agent that reads "-Infinity" back cannot act on it.
 */
const describeTimeRange = (grapherState: GrapherState): string => {
    const { startTime, endTime } = grapherState
    if (startTime === undefined || endTime === undefined)
        return "the full range of the data"
    return `${startTime} to ${endTime}`
}

/** Before the data has loaded, `times` is empty and the naive template reads
 *  "years undefined to undefined" — which an agent will happily relay. */
const describeDataYears = (grapherState: GrapherState): string => {
    const { times } = grapherState
    if (!times.length)
        return "Data not loaded yet; call this again in a moment for the year range"
    return `Data available for years ${times[0]} to ${times[times.length - 1]}`
}

export function buildGrapherTools(grapherState: GrapherState): WebMcpTool[] {
    return [
        {
            name: "get_chart_state",
            description:
                "Read the current state of the chart on this page: its title, " +
                "which entities (countries/regions) are selected, the time range " +
                "shown, and which view is active. Call this before making a " +
                "relative change such as adding an entity to the existing selection.",
            inputSchema: { type: "object", properties: {} },
            execute: async () =>
                toolResult(
                    [
                        `Chart: ${grapherState.title ?? grapherState.displaySlug}`,
                        `Selected entities: ${
                            grapherState.selection.selectedEntityNames.join(
                                ", "
                            ) || "(none)"
                        }`,
                        `Time range shown: ${describeTimeRange(grapherState)}`,
                        describeDataYears(grapherState),
                        `Active view: ${grapherState.activeTab}`,
                        `Available views: ${grapherState.availableTabs.join(", ")}`,
                        `${grapherState.availableEntityNames.length} entities available on this chart`,
                    ].join("\n")
                ),
        },

        {
            name: "list_chart_entities",
            description:
                "List the countries and regions available on this chart. Use the " +
                "optional query to filter, and always use the exact names returned " +
                "here when selecting entities.",
            inputSchema: {
                type: "object",
                properties: {
                    query: {
                        type: "string",
                        description:
                            "Case-insensitive substring filter, e.g. 'slov' or 'income'",
                    },
                },
            },
            execute: async ({ query }: { query?: string }) => {
                const all = grapherState.availableEntityNames
                const matches = query
                    ? all.filter((name) =>
                          name.toLowerCase().includes(query.toLowerCase())
                      )
                    : all
                if (!matches.length)
                    return toolResult(
                        `No entities on this chart match "${query}". The chart has ${all.length} entities.`
                    )
                const shown = matches.slice(0, 100)
                const suffix =
                    matches.length > shown.length
                        ? ` (showing first ${shown.length} of ${matches.length})`
                        : ""
                return toolResult(`${shown.join(", ")}${suffix}`)
            },
        },

        {
            name: "select_entities",
            description:
                "Set which countries or regions the chart shows, replacing the " +
                "current selection. Use exact names from list_chart_entities. To " +
                "add to what is already shown without removing anything, use " +
                "add_entities instead.",
            inputSchema: {
                type: "object",
                properties: {
                    entities: {
                        type: "array",
                        items: { type: "string" },
                        description:
                            "Exact entity names, e.g. ['Czechia', 'Slovakia']",
                    },
                },
                required: ["entities"],
            },
            execute: async ({ entities }: { entities: string[] }) => {
                const { resolved, unresolved } = matchEntities(
                    entities,
                    grapherState.availableEntityNames
                )
                if (unresolved.length)
                    return toolResult(
                        `${describeUnresolved(unresolved)} Nothing was changed.`
                    )
                grapherState.selection.setSelectedEntities(resolved)
                return toolResult(describeSelection(grapherState))
            },
        },

        {
            name: "add_entities",
            description:
                "Add countries or regions to the chart's current selection, " +
                "keeping what is already shown. Use this for requests like " +
                "'also show Poland' or 'add the EU average'.",
            inputSchema: {
                type: "object",
                properties: {
                    entities: {
                        type: "array",
                        items: { type: "string" },
                        description: "Exact entity names to add",
                    },
                },
                required: ["entities"],
            },
            execute: async ({ entities }: { entities: string[] }) => {
                const { resolved, unresolved } = matchEntities(
                    entities,
                    grapherState.availableEntityNames
                )
                if (unresolved.length)
                    return toolResult(
                        `${describeUnresolved(unresolved)} Nothing was changed.`
                    )
                grapherState.selection.addToSelection(resolved)
                return toolResult(describeSelection(grapherState))
            },
        },

        {
            name: "set_time_range",
            description:
                "Set the time range the chart displays, e.g. for 'since 1990' or " +
                "'between 2000 and 2020'. Omit either bound to leave it unchanged.",
            inputSchema: {
                type: "object",
                properties: {
                    startYear: {
                        type: "number",
                        description: "First year to show",
                    },
                    endYear: {
                        type: "number",
                        description: "Last year to show",
                    },
                },
            },
            execute: async ({
                startYear,
                endYear,
            }: {
                startYear?: number
                endYear?: number
            }) => {
                if (startYear === undefined && endYear === undefined)
                    return toolResult(
                        "Provide startYear, endYear, or both. Nothing was changed."
                    )
                const times = grapherState.times
                const [dataStart, dataEnd] = [times[0], times[times.length - 1]]
                // Fall back to the resolved times, not the raw handle bounds:
                // those are ±Infinity at the default extent, and carrying one
                // into a partial update would silently widen the other end.
                const nextStart =
                    startYear ?? grapherState.startTime ?? dataStart
                const nextEnd = endYear ?? grapherState.endTime ?? dataEnd
                if (nextStart > nextEnd)
                    return toolResult(
                        `Start year ${nextStart} is after end year ${nextEnd}. Nothing was changed.`
                    )
                grapherState.timelineHandleTimeBounds = [nextStart, nextEnd]
                const clamped =
                    nextStart < dataStart || nextEnd > dataEnd
                        ? ` Note the chart only has data for ${dataStart}-${dataEnd}, so the visible range is clamped to that.`
                        : ""
                return toolResult(
                    `Time range set to ${describeTimeRange(grapherState)}.${clamped}`
                )
            },
        },

        {
            name: "set_chart_view",
            description:
                "Switch which view of the data is shown — a line chart, the world " +
                "map, the data table, or any other view this chart offers. Use this " +
                "for 'show it as a line chart' or 'show me the map': many OWID " +
                "charts open on the map, and switching view does NOT require " +
                "navigating. Call get_chart_state to see which views are available.",
            inputSchema: {
                type: "object",
                properties: {
                    view: {
                        type: "string",
                        description:
                            "One of the values listed in get_chart_state's 'Available " +
                            "views', or a plain name like 'line', 'line chart', 'map', " +
                            "'table', 'slope' or 'bar'",
                    },
                },
                required: ["view"],
            },
            execute: async ({ view }: { view: string }) => {
                const available = grapherState.availableTabs
                // Tab names are internal identifiers ("LineChart"), but a model
                // relays what the user said ("line chart", "line"). Comparing
                // on alphanumerics only, and letting a bare "line" match
                // "LineChart", closes the gap without a synonym table.
                const normalize = (value: string): string =>
                    value.toLowerCase().replace(/[^a-z0-9]/g, "")
                const wanted = normalize(view)
                const shorthand: Record<string, GrapherTabName> = {
                    map: GRAPHER_TAB_NAMES.WorldMap,
                    worldmap: GRAPHER_TAB_NAMES.WorldMap,
                    table: GRAPHER_TAB_NAMES.Table,
                    datatable: GRAPHER_TAB_NAMES.Table,
                }
                const requested =
                    shorthand[wanted] ??
                    available.find((tab) => normalize(tab) === wanted) ??
                    available.find(
                        (tab) => normalize(tab) === `${wanted}chart`
                    ) ??
                    (wanted === "chart"
                        ? available.find(
                              (tab) =>
                                  tab !== GRAPHER_TAB_NAMES.WorldMap &&
                                  tab !== GRAPHER_TAB_NAMES.Table
                          )
                        : undefined)
                if (!requested || !available.includes(requested))
                    return toolResult(
                        `This chart does not offer a "${view}" view. Available views: ${available.join(", ")}. Nothing was changed.`
                    )
                grapherState.setTab(requested)
                return toolResult(`Switched to the ${requested} view.`)
            },
        },
        {
            name: "get_chart_data",
            description:
                "Read the actual data values behind the chart on this page, as CSV, " +
                "for the entities and time range currently shown. ALWAYS call this " +
                "before stating any number, trend, or comparison — do not answer " +
                "from memory, because the figures you recall may not match this " +
                "chart's source, units, or revision.",
            inputSchema: { type: "object", properties: {} },
            execute: async () => {
                // filteredTableForDownload, not tableForDownload: the latter is
                // every entity on the chart. Driving this on
                // /grapher/electricity-mix with four countries selected
                // returned 7,612 rows, and the 400-row cap then cut it off in
                // the As — so the answer to "what is Czechia's share" was 400
                // rows of ASEAN and Afghanistan, under a description promising
                // the entities currently shown.
                const table = grapherState.filteredTableForDownload
                if (!table || table.numRows === 0)
                    return toolResult(
                        "No data is loaded for this chart yet. Wait a moment and try again."
                    )
                const csv = table.toPrettyCsv()
                const lines = csv.split("\n")
                if (lines.length - 1 <= MAX_DATA_ROWS) return toolResult(csv)
                const head = lines.slice(0, MAX_DATA_ROWS + 1).join("\n")
                return toolResult(
                    `${head}\n\n[Truncated: showing ${MAX_DATA_ROWS} of ${lines.length - 1} rows. ` +
                        `Narrow the selection with select_entities or set_time_range, ` +
                        `or use download_chart_data for the complete file.]`
                )
            },
        },

        {
            name: "get_chart_metadata",
            description:
                "Read this chart's sources, units, and Our World in Data's own " +
                "curated notes about how the data should and should not be " +
                "interpreted. Call this before explaining what a chart means or " +
                "why values differ between countries — these caveats are written " +
                "by the researchers who assembled the data.",
            inputSchema: { type: "object", properties: {} },
            execute: async () => {
                const columns = grapherState.yColumnsFromDimensionsOrSlugsOrAuto
                const parts: string[] = [
                    `Chart: ${grapherState.title ?? grapherState.displaySlug}`,
                ]
                if (grapherState.subtitle)
                    parts.push(`Subtitle: ${grapherState.subtitle}`)
                if (grapherState.note) parts.push(`Note: ${grapherState.note}`)
                parts.push(
                    `Sources: ${grapherState.sourcesLine || "(not stated)"}`
                )
                if (grapherState.baseUrl)
                    parts.push(`Canonical URL: ${grapherState.baseUrl}`)

                for (const column of columns) {
                    // Grapher's columns are typed as CoreColumn, but every
                    // column of an OwidTable carries an OwidColumnDef.
                    const def = column.def as OwidColumnDef
                    const lines = [`\nIndicator: ${column.displayName}`]
                    if (column.unit) lines.push(`  Unit: ${column.unit}`)
                    if (def.descriptionShort)
                        lines.push(`  Description: ${def.descriptionShort}`)
                    if (def.descriptionKey)
                        lines.push(
                            `  Key information from OWID researchers: ${def.descriptionKey}`
                        )
                    if (def.descriptionProcessing)
                        lines.push(
                            `  How OWID processed this: ${def.descriptionProcessing}`
                        )
                    parts.push(lines.join("\n"))
                }
                return toolResult(parts.join("\n"))
            },
        },

        {
            name: "get_chart_image_url",
            description:
                "Get a URL for a static PNG or SVG image of the chart as it is " +
                "currently configured, for embedding in a reply or sharing. This " +
                "returns a link only — it does NOT navigate the page. Never " +
                "navigate the tab to an image: doing so unloads the chart and all " +
                "of these tools stop working.",
            inputSchema: {
                type: "object",
                properties: {
                    format: {
                        type: "string",
                        enum: ["png", "svg"],
                        description: "Image format, defaults to png",
                    },
                },
            },
            execute: async ({ format }: { format?: string }) => {
                const base = grapherState.baseUrl
                if (!base)
                    return toolResult(
                        "This chart has no public URL, so no image can be linked."
                    )
                const extension = format === "svg" ? "svg" : "png"
                return toolResult(
                    `${base}.${extension}${grapherState.queryStr}\n\n` +
                        `This image reflects the current selection and time range. ` +
                        `Present it as a link or an image; do not navigate to it.`
                )
            },
        },

        {
            name: "download_chart_data",
            description:
                "Give the user a download link for this chart's data as a CSV " +
                "file, covering the entities and time range currently shown. Use " +
                "when the user asks to download, export, or save the data.",
            inputSchema: {
                type: "object",
                properties: {
                    scope: {
                        type: "string",
                        enum: ["shown", "full"],
                        description:
                            "'shown' (default) respects the current selection and time range; " +
                            "'full' downloads every entity and year on the chart",
                    },
                },
            },
            execute: async ({ scope }: { scope?: string }) => {
                const base = grapherState.baseUrl
                if (!base)
                    return toolResult(
                        "This chart has no public URL, so no download can be linked."
                    )
                const filtered = scope !== "full"
                const params = new URLSearchParams(
                    grapherState.queryStr.replace(/^\?/, "")
                )
                params.set("csvType", filtered ? "filtered" : "full")
                params.set("useColumnShortNames", "true")
                const query = params.toString().replaceAll("%7E", "~")
                return toolResult(
                    `${base}.csv?${query}\n\n` +
                        `CSV covering ${filtered ? "the current selection and time range" : "the full chart"}. ` +
                        `Offer this to the user as a download link.`
                )
            },
        },
    ]
}

export async function registerGrapherTools(
    grapherState: GrapherState,
    signal?: AbortSignal
): Promise<void> {
    await registerTools(buildGrapherTools(grapherState), signal)
}
