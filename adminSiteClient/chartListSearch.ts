import {
    buildSearchWordsFromSearchString,
    filterFunctionForSearchWords,
} from "../adminShared/search.js"
import type { ChartListItem } from "./ChartList.js"

/**
 * The fields the charts list searches over. Shared by the `ChartList` search
 * box and the WebMCP `find_charts` tool so both find the same charts for the
 * same query.
 */
export function chartSearchFields(
    chart: ChartListItem
): (string | undefined)[] {
    return [
        chart.title,
        chart.variantName,
        chart.internalNotes,
        chart.publishedBy,
        chart.lastEditedBy,
        `${chart.id}`,
        chart.slug,
        chart.hasChartTab !== false ? chart.type : undefined,
        chart.hasMapTab ? "Map" : undefined,
        ...chart.tags.map((tag) => tag.name),
    ]
}

/**
 * Filters with the admin's search grammar: words match in any order and any
 * field, `"quoted phrases"` match verbatim, `-word` excludes. An empty search
 * returns every chart.
 */
export function filterChartsBySearchString(
    charts: ChartListItem[],
    search: string | undefined
): ChartListItem[] {
    const searchWords = buildSearchWordsFromSearchString(search)
    if (searchWords.length === 0) return charts
    return charts.filter(
        filterFunctionForSearchWords(searchWords, chartSearchFields)
    )
}
