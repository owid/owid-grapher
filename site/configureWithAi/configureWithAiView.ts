import { runInAction } from "mobx"
import {
    generateSelectedEntityNamesParam,
    GrapherState,
} from "@ourworldindata/grapher"
import {
    GrapherQueryParams,
    MultiDimDimensionChoices,
    SortOrder,
} from "@ourworldindata/types"
import type { SitePage } from "./configureWithAiStore.js"

/** Mirrors ViewfinderView in functions/api/configure-with-ai/viewfinder.ts */
export interface ConfigureWithAiView {
    label: string
    note: string | null
    /** The view stands in for something the data doesn't have */
    closestMatch: boolean
    /** Written by code: how a ranked view's countries were picked, or how many shown have data */
    facts: string | null
    options?: MultiDimDimensionChoices
    tab: string
    entities: string[]
    time: string | null
    mapRegion: string | null
    tableSort: {
        column: "value" | "change" | "relativeChange" | "entity"
        order: "asc" | "desc"
    } | null
    tableFilter: "selection" | null
}

export function viewToGrapherQueryParams(
    view: ConfigureWithAiView
): GrapherQueryParams {
    const params: GrapherQueryParams = { tab: view.tab }
    if (view.time) params.time = view.time
    if (view.mapRegion) params.region = view.mapRegion
    // Always set, so an MDim view switch doesn't keep the previous filter
    params.tableFilter = view.tableFilter ?? "all"
    if (view.entities.length)
        params.country = generateSelectedEntityNamesParam(view.entities)
    return params
}

type DataTableColumnKey = NonNullable<
    GrapherState["dataTableSort"]
>["columnKey"]

export function viewToDataTableSort(
    view: ConfigureWithAiView
): GrapherState["dataTableSort"] {
    if (view.tab !== "table" || !view.tableSort) return undefined
    const { column, order } = view.tableSort
    const isRange =
        !!view.time?.includes("..") && !/^(\S+)\.\.\1$/.test(view.time)
    const columnKey =
        column === "entity"
            ? undefined
            : column === "change"
              ? "delta"
              : column === "relativeChange"
                ? "deltaRatio"
                : isRange
                  ? "end"
                  : "single"
    return {
        dimIndex: column === "entity" ? -1 : 0,
        // The string enums PointColumnKey/RangeColumnKey aren't exported
        columnKey: columnKey as DataTableColumnKey,
        order: order === "asc" ? SortOrder.asc : SortOrder.desc,
    }
}

/** Applies a view to a single-chart Grapher (MDim pages switch the view first) */
export function applyViewToGrapherState(
    grapherState: GrapherState,
    view: ConfigureWithAiView
): void {
    runInAction(() => {
        grapherState.clearQueryParams()
        grapherState.populateFromQueryParams(viewToGrapherQueryParams(view))
        grapherState.dataTableSort = viewToDataTableSort(view)
    })
}

/** Sets the table sort an MDim view asks for, before the page switches to its combination */
export function applyTableSortToGrapherState(
    grapherState: GrapherState,
    view: ConfigureWithAiView
): void {
    grapherState.dataTableSort = viewToDataTableSort(view)
}

export interface GrapherSnapshot {
    params: Partial<GrapherQueryParams>
    dataTableSort: GrapherState["dataTableSort"]
}

/** The parts of a Grapher's view that a reader or a view can change */
export function snapshotGrapherState(
    grapherState: GrapherState
): GrapherSnapshot {
    return {
        params: { ...grapherState.changedParams },
        dataTableSort: grapherState.dataTableSort,
    }
}

export function restoreGrapherState(
    grapherState: GrapherState,
    snapshot: GrapherSnapshot
): void {
    runInAction(() => {
        grapherState.clearQueryParams()
        grapherState.populateFromQueryParams(snapshot.params)
        grapherState.dataTableSort = snapshot.dataTableSort
    })
}

/** The table's sort in a view's terms, for the model to keep on follow-ups */
export function dataTableSortToViewSort(
    sort: GrapherState["dataTableSort"]
): ConfigureWithAiView["tableSort"] {
    if (!sort) return null
    const order = sort.order === SortOrder.asc ? "asc" : "desc"
    if (sort.dimIndex < 0 || !sort.columnKey) return { column: "entity", order }
    const column =
        sort.columnKey === "delta"
            ? "change"
            : sort.columnKey === "deltaRatio"
              ? "relativeChange"
              : "value"
    return { column, order }
}

/**
 * A thumbnail for a page the model pointed to: the chart from the thumbnail
 * service with the link's settings, an article's own image, or null (explorer
 * views and tables, which the service can't draw as linked)
 */
export function pageThumbnailUrl(
    grapherBaseUrl: string,
    page: SitePage
): string | null {
    if (page.kind === "article" || page.kind === "topic")
        return page.thumbnailUrl
    const url = new URL(page.url, "https://ourworldindata.org")
    const slug = url.pathname.match(/^\/grapher\/([^/]+)$/)?.[1]
    if (page.kind !== "chart" || !slug || page.tab === "table") return null
    url.searchParams.set("imType", "thumbnail")
    return `${grapherBaseUrl}/${slug}.png${url.search}`
}

/**
 * A thumbnail of the view from the chart thumbnail service, or null for a
 * table, which the service draws as a single-year chart instead
 */
export function viewThumbnailUrl(
    grapherBaseUrl: string,
    slug: string,
    view: ConfigureWithAiView
): string | null {
    if (view.tab === "table") return null
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(view.options ?? {}))
        params.set(key, value)
    for (const [key, value] of Object.entries(viewToGrapherQueryParams(view)))
        if (value !== undefined && key !== "tableFilter")
            params.set(key, String(value))
    params.set("imType", "thumbnail")
    return `${grapherBaseUrl}/${slug}.png?${params.toString()}`
}
