import { GRAPHER_TAB_NAMES, GrapherTabName } from "@ourworldindata/types"
import { GrapherState } from "../core/GrapherState.js"
import { WebMcpTool, registerTools, toolResult } from "./webmcpTypes.js"

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
                        `Data available for years ${grapherState.times[0]} to ${
                            grapherState.times[grapherState.times.length - 1]
                        }`,
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
                "Switch which view of the data is shown — the chart itself, the " +
                "world map, or the data table. Call get_chart_state first to see " +
                "which views this chart offers.",
            inputSchema: {
                type: "object",
                properties: {
                    view: {
                        type: "string",
                        description:
                            "One of the values listed in get_chart_state's 'Available views', " +
                            "or the shorthand 'map', 'table', or 'chart'",
                    },
                },
                required: ["view"],
            },
            execute: async ({ view }: { view: string }) => {
                const available = grapherState.availableTabs
                const shorthand: Record<string, GrapherTabName> = {
                    map: GRAPHER_TAB_NAMES.WorldMap,
                    table: GRAPHER_TAB_NAMES.Table,
                }
                const requested =
                    shorthand[view.toLowerCase()] ??
                    available.find(
                        (tab) => tab.toLowerCase() === view.toLowerCase()
                    ) ??
                    (view.toLowerCase() === "chart"
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
    ]
}

export async function registerGrapherTools(
    grapherState: GrapherState,
    signal?: AbortSignal
): Promise<void> {
    await registerTools(buildGrapherTools(grapherState), signal)
}
