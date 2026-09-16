import { makeSearchFilter, SearchField } from "../adminShared/searchFilter.js"
import type { ChartListItem } from "./ChartList.js"

/**
 * The fields the charts list searches over. Shared by the `ChartList` search
 * box and the WebMCP `find_charts` tool so both find the same charts for the
 * same query.
 */
export const CHART_SEARCH_FIELDS: SearchField<ChartListItem>[] = [
    {
        name: "title",
        type: "string",
        description: "Chart title",
        get: (chart) => chart.title,
    },
    {
        name: "variant",
        type: "string",
        description: "Variant name",
        get: (chart) => chart.variantName,
    },
    {
        name: "slug",
        type: "string",
        description: "Slug",
        get: (chart) => chart.slug,
    },
    {
        name: "notes",
        type: "string",
        description: "Internal notes",
        get: (chart) => chart.internalNotes,
    },
    {
        name: "by",
        type: "string",
        description: "Who published or last edited it",
        get: (chart) => [chart.publishedBy, chart.lastEditedBy],
    },
    {
        name: "tag",
        type: "string",
        description: "Tag",
        get: (chart) => chart.tags.map((tag) => tag.name),
    },
    {
        name: "type",
        type: "string",
        description: "Chart type, or Map",
        get: (chart) => [
            chart.hasChartTab !== false ? chart.type : undefined,
            chart.hasMapTab ? "Map" : undefined,
        ],
    },
    {
        name: "id",
        type: "number",
        description: "Chart id",
        get: (chart) => chart.id,
    },
    {
        name: "published",
        type: "boolean",
        description: "Published",
        get: (chart) => chart.isPublished,
    },
    {
        name: "views",
        type: "number",
        description: "Grapher views per day",
        get: (chart) => chart.grapherViewsPerDay,
    },
    {
        name: "edited",
        type: "date",
        description: "When it was last edited",
        get: (chart) => chart.lastEditedAt,
    },
]

/**
 * Filters with the admin's search grammar: words match in any order and any
 * free-text field, `"quoted phrases"` match verbatim, `-word` excludes, and
 * `field:value` matches one field. An empty search returns every chart.
 */
export function filterChartsBySearchString(
    charts: ChartListItem[],
    search: string | undefined
): ChartListItem[] {
    if (!search?.trim()) return charts
    return charts.filter(makeSearchFilter(search, CHART_SEARCH_FIELDS))
}
