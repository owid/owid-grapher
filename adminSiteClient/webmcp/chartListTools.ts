/**
 * WebMCP tools for the charts list page (/admin/charts).
 *
 * `find_charts` (admin-wide) answers questions; this set changes what the
 * person is looking at, by driving the page's own search box.
 */
import type { ChartListItem } from "../ChartList.js"
import { describeChart, DEFAULT_RESULT_LIMIT } from "./adminTools.js"
import { registerToolSet, toolResult, type WebMcpTool } from "./webmcpTypes.js"

export const CHART_LIST_TOOL_SET = "chart-list"

export interface ChartListToolContext {
    getCharts: () => ChartListItem[]
    getFilteredCharts: () => ChartListItem[]
    getSearchInput: () => string | undefined
    setSearchInput: (input: string) => void
}

export function buildChartListTools(
    context: ChartListToolContext
): WebMcpTool[] {
    return [
        {
            name: "search_chart_list",
            description:
                "Filter the charts list the user is looking at, exactly as " +
                "typing into its search box would. Matches title, slug, id, " +
                "chart type, tag, internal notes and editor names; words match " +
                'in any order, "quotes" match a phrase, -word excludes. Pass ' +
                "an empty query to clear the filter.",
            inputSchema: {
                type: "object",
                properties: {
                    query: { type: "string" },
                },
                required: ["query"],
            },
            execute: async ({ query }: { query: string }) => {
                const input = (query ?? "").trim()
                context.setSearchInput(input)
                const total = context.getCharts().length
                if (total === 0)
                    return toolResult(
                        "The chart list has not loaded yet. Try again in a moment."
                    )
                const matches = context.getFilteredCharts()
                if (!input)
                    return toolResult(
                        `Cleared the search; the list shows all ${total} charts.`
                    )
                if (matches.length === 0)
                    return toolResult(
                        `The list is filtered by "${input}" and shows no charts. Try fewer or different words.`
                    )
                const shown = matches.slice(0, DEFAULT_RESULT_LIMIT)
                const footer =
                    matches.length > shown.length
                        ? `\n[Listing ${shown.length} of ${matches.length}; the page shows the rest on scroll.]`
                        : ""
                return toolResult(
                    `The list is filtered by "${input}" and shows ${matches.length} of ${total} charts:\n` +
                        shown.map(describeChart).join("\n") +
                        footer
                )
            },
        },
    ]
}

export function registerChartListTools(
    context: ChartListToolContext,
    signal: AbortSignal
): Promise<void> {
    return registerToolSet(
        CHART_LIST_TOOL_SET,
        buildChartListTools(context),
        signal
    )
}
