import { GrapherTabName } from "@ourworldindata/types"
import { SearchChartHitDataDisplayProps } from "./SearchChartHitDataDisplay.js"
import { SearchChartHitDataTableContent } from "./SearchChartHitDataTableHelpers.js"
import { SearchChartHitComponentVariant } from "./searchTypes.js"

export type RichDataComponentVariant = Extract<
    SearchChartHitComponentVariant,
    "large" | "medium"
>

export enum PreviewVariant {
    Thumbnail = "thumbnail",
    Large = "large",
}

export interface PreviewType {
    variant: PreviewVariant
    isMinimal: boolean
}

// These values are used as class names. Be careful when changing them.
export enum MediumVariantGridSlot {
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
// These values are used as class names. Be careful when changing them.
export enum LargeVariantGridSlot {
    // Full grid (all cells)
    Full = "full",
    // Cell numbers 1, 2, 5, 6
    LeftQuad = "left-quad",
    // Cell numbers 3, 4, 7, 8
    RightQuad = "right-quad",
    // Cell numbers 3, 7
    RightQuadLeftColumn = "right-quad-left-column",
    // Cell numbers 7, 8
    RightQuadBottomRow = "right-quad-bottom-row",
    // Cell number 4
    TopRightCell = "top-right-cell",
    // Cell number 8
    BottomRightCell = "bottom-right-cell",
    // Any cell, no specific number
    SingleCell = "single-cell",
}

export type GridSlot = MediumVariantGridSlot | LargeVariantGridSlot

export interface PlacedTab<TSlot extends string> {
    tab: GrapherTabName
    slot: TSlot
}

export interface Layout<TSlot extends string> {
    placedTabs: PlacedTab<TSlot>[]
    dataTableContent: SearchChartHitDataTableContent
    dataDisplayProps?: SearchChartHitDataDisplayProps
}
