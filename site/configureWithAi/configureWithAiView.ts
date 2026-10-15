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

/** Mirrors ViewfinderView in functions/api/configure-with-ai/viewfinder.ts */
export interface ConfigureWithAiView {
    label: string
    note: string | null
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
    if (view.tableFilter) params.tableFilter = view.tableFilter
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
