import { describe, it, expect } from "vitest"
import { GRAPHER_TAB_NAMES } from "@ourworldindata/types"
import { LargeVariantGridSlot } from "./SearchChartHitRichDataTypes.js"
import { placeGrapherTabsInLargeVariantGrid } from "./SearchChartHitRichDataLargeVariantHelpers.js"

describe(placeGrapherTabsInLargeVariantGrid, () => {
    const { LineChart, Table, WorldMap, DiscreteBar, Marimekko } =
        GRAPHER_TAB_NAMES

    it("works for a typical case", () => {
        const tabs = [LineChart, Table, WorldMap, DiscreteBar]
        const result = placeGrapherTabsInLargeVariantGrid(tabs, {
            tableType: "data-table",
            numDataTableRows: 4,
            numDataTableRowsPerColumn: 10,
        })

        expect(result).toEqual([
            { tab: LineChart, slot: LargeVariantGridSlot.LeftQuad },
            { tab: Table, slot: LargeVariantGridSlot.RightQuadLeftColumn },
            { tab: WorldMap, slot: LargeVariantGridSlot.BottomRightCell },
            { tab: DiscreteBar, slot: LargeVariantGridSlot.TopRightCell },
        ])
    })

    it("drops tabs when there are too many", () => {
        const tabs = [LineChart, Table, WorldMap, Marimekko, DiscreteBar]
        const result = placeGrapherTabsInLargeVariantGrid(tabs, {
            tableType: "data-table",
            numDataTableRows: 2,
            numDataTableRowsPerColumn: 10,
        })

        expect(result).toEqual([
            { tab: LineChart, slot: LargeVariantGridSlot.LeftQuad },
            { tab: Table, slot: LargeVariantGridSlot.RightQuadLeftColumn },
            { tab: WorldMap, slot: LargeVariantGridSlot.BottomRightCell },
            { tab: Marimekko, slot: LargeVariantGridSlot.TopRightCell },
        ])
    })

    it("places single extra thumbnail in bottom right cell", () => {
        const tabs = [LineChart, Table, WorldMap]
        const result = placeGrapherTabsInLargeVariantGrid(tabs, {
            tableType: "data-table",
            numDataTableRows: 2,
            numDataTableRowsPerColumn: 10,
        })

        expect(result).toEqual([
            { tab: LineChart, slot: LargeVariantGridSlot.LeftQuad },
            { tab: Table, slot: LargeVariantGridSlot.RightQuadLeftColumn },
            { tab: WorldMap, slot: LargeVariantGridSlot.BottomRightCell },
        ])
    })

    it("keeps table with many rows in single column when there are other tabs", () => {
        const tabs = [LineChart, Table, WorldMap]
        const result = placeGrapherTabsInLargeVariantGrid(tabs, {
            tableType: "data-table",
            numDataTableRows: 24,
            numDataTableRowsPerColumn: 10,
        })

        expect(result).toEqual([
            { tab: LineChart, slot: LargeVariantGridSlot.LeftQuad },
            { tab: Table, slot: LargeVariantGridSlot.RightQuadLeftColumn },
            { tab: WorldMap, slot: LargeVariantGridSlot.BottomRightCell },
        ])
    })

    it("uses the full space for the table when there are no other tabs", () => {
        const tabs = [LineChart, Table]
        const result = placeGrapherTabsInLargeVariantGrid(tabs, {
            tableType: "data-table",
            numDataTableRows: 20,
            numDataTableRowsPerColumn: 10,
        })

        expect(result).toEqual([
            { tab: LineChart, slot: LargeVariantGridSlot.LeftQuad },
            { tab: Table, slot: LargeVariantGridSlot.RightQuad },
        ])
    })

    it("only uses the full space for the table when there is enough data", () => {
        const tabs = [LineChart, Table]
        const result = placeGrapherTabsInLargeVariantGrid(tabs, {
            tableType: "data-table",
            numDataTableRows: 10,
            numDataTableRowsPerColumn: 10,
        })

        expect(result).toEqual([
            { tab: LineChart, slot: LargeVariantGridSlot.LeftQuad },
            { tab: Table, slot: LargeVariantGridSlot.RightQuadLeftColumn },
        ])
    })

    it("should handle single tab case", () => {
        const tabs = [Table]
        const result = placeGrapherTabsInLargeVariantGrid(tabs, {
            tableType: "data-table",
            numDataTableRows: 6,
            numDataTableRowsPerColumn: 10,
        })

        expect(result).toEqual([
            { tab: Table, slot: LargeVariantGridSlot.Full },
        ])
    })

    it("uses the full space for the data points when there are no other tabs", () => {
        const tabs = [LineChart, Table]
        const result = placeGrapherTabsInLargeVariantGrid(tabs, {
            tableType: "data-points",
        })

        expect(result).toEqual([
            { tab: LineChart, slot: LargeVariantGridSlot.LeftQuad },
            { tab: Table, slot: LargeVariantGridSlot.RightQuad },
        ])
    })

    it("places data points on the bottom when there are other tabs", () => {
        const tabs = [LineChart, Table, DiscreteBar]
        const result = placeGrapherTabsInLargeVariantGrid(tabs, {
            tableType: "data-points",
        })

        expect(result).toEqual([
            { tab: LineChart, slot: LargeVariantGridSlot.LeftQuad },
            { tab: Table, slot: LargeVariantGridSlot.RightQuadBottomRow },
            { tab: DiscreteBar, slot: LargeVariantGridSlot.SingleCell },
        ])
    })
})
