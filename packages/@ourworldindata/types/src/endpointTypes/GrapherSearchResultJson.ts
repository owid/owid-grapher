import {
    GrapherQueryParams,
    GrapherTabName,
    GrapherTrendArrowDirection,
} from "../grapherTypes/GrapherTypes"

/** Type definition for data retrieved from the `/grapher/slug.search-result.json` endpoint */
export type GrapherSearchResultJson = {
    title: string
    subtitle?: string
    source: string
    grapherQueryParams: GrapherQueryParams
    layout: LayoutSlot[]
    dataTable: SearchChartHitDataTableProps
    entityType: string
    entityTypePlural: string
}

export interface SearchChartHitDataTableProps {
    rows: TableRow[]
    title: string
}

interface TableRow {
    seriesName?: string
    label: string
    color?: string
    value?: string
    startValue?: string
    time?: string
    timePreposition?: string
    muted?: boolean
    striped?: boolean | "no-data"
    outlined?: boolean
    rounded?: boolean
    trend?: GrapherTrendArrowDirection // only relevant if startValue is given
}

export interface LayoutSlot<TSlotKey extends GridSlotKey = GridSlotKey> {
    slotKey: TSlotKey
    grapherTab: GrapherTabName
    chartParams?: GrapherQueryParams
    previewParams?: GrapherQueryParams
}

export type GridSlotKey = MediumVariantGridSlotKey | LargeVariantGridSlotKey

// The medium variant is a one-dimensional grid layout
// where the last quarter might contain two smaller slots
export enum MediumVariantGridSlotKey {
    Single = "single-slot",
    Double = "double-slot",
    Triple = "triple-slot",
    Quad = "quad-slot",
    SmallLeft = "small-slot-left",
    SmallRight = "small-slot-right",
}

// The large variant occupies a 4x2 grid layout:
// -----------------
// │ 1 │ 2 │ 3 │ 4 │
// -----------------
// │ 5 │ 6 │ 7 │ 8 │
// -----------------
export enum LargeVariantGridSlotKey {
    // Full grid (all cells)
    Full = "full",
    // Cell numbers 1, 2, 5, 6
    LeftQuad = "left-quad",
    // Cell numbers 3, 4, 7, 8
    RightQuad = "right-quad",
    // Cell numbers 3, 7
    RightQuadLeftColumn = "right-quad-left-column",
    // Cell number 4
    TopRightCell = "top-right-cell",
    // Cell number 8
    BottomRightCell = "bottom-right-cell",
    // Any cell, no specific number
    SingleCell = "single-cell",
}

export interface SearchChartHitDataDisplayProps {
    entityName: string
    endValue: string
    time: string
    unit?: string
    startValue?: string // if given, display as a range
    trend?: GrapherTrendArrowDirection // only relevant if startValue is given
    showLocationIcon?: boolean
    className?: string
    numericEndTime?: number // not displayed, but useful to know
}
