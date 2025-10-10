import { describe, it, expect } from "vitest"
import {
    GRAPHER_TAB_NAMES,
    LargeVariantGridSlotKey,
} from "@ourworldindata/types"
import { placeGrapherTabsInLargeVariantGrid } from "./LargeVariantRichDataHelpers.js"

const {
    Full,
    LeftQuad,
    RightQuad,
    RightQuadLeftColumn,
    BottomRightCell,
    TopRightCell,
    RightQuadBottomRow,
    SingleCell,
} = LargeVariantGridSlotKey

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
            {
                grapherTab: LineChart,
                slotKey: LeftQuad,
            },
            {
                grapherTab: Table,
                slotKey: RightQuadLeftColumn,
            },
            {
                grapherTab: WorldMap,
                slotKey: BottomRightCell,
            },
            {
                grapherTab: DiscreteBar,
                slotKey: TopRightCell,
            },
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
            {
                grapherTab: LineChart,
                slotKey: LeftQuad,
            },
            {
                grapherTab: Table,
                slotKey: RightQuadLeftColumn,
            },
            {
                grapherTab: WorldMap,
                slotKey: BottomRightCell,
            },
            {
                grapherTab: Marimekko,
                slotKey: TopRightCell,
            },
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
            {
                grapherTab: LineChart,
                slotKey: LeftQuad,
            },
            {
                grapherTab: Table,
                slotKey: RightQuadLeftColumn,
            },
            {
                grapherTab: WorldMap,
                slotKey: BottomRightCell,
            },
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
            {
                grapherTab: LineChart,
                slotKey: LeftQuad,
            },
            {
                grapherTab: Table,
                slotKey: RightQuadLeftColumn,
            },
            {
                grapherTab: WorldMap,
                slotKey: BottomRightCell,
            },
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
            {
                grapherTab: LineChart,
                slotKey: LeftQuad,
            },
            { grapherTab: Table, slotKey: RightQuad },
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
            {
                grapherTab: LineChart,
                slotKey: LeftQuad,
            },
            {
                grapherTab: Table,
                slotKey: RightQuadLeftColumn,
            },
        ])
    })

    it("should handle single tab case", () => {
        const tabs = [Table]
        const result = placeGrapherTabsInLargeVariantGrid(tabs, {
            tableType: "data-table",
            numDataTableRows: 6,
            numDataTableRowsPerColumn: 10,
        })

        expect(result).toEqual([{ grapherTab: Table, slotKey: Full }])
    })

    it("uses the full space for the data points when there are no other tabs", () => {
        const tabs = [LineChart, Table]
        const result = placeGrapherTabsInLargeVariantGrid(tabs, {
            tableType: "data-points",
        })

        expect(result).toEqual([
            {
                grapherTab: LineChart,
                slotKey: LeftQuad,
            },
            { grapherTab: Table, slotKey: RightQuad },
        ])
    })

    it("places data points on the bottom when there are other tabs", () => {
        const tabs = [LineChart, Table, DiscreteBar]
        const result = placeGrapherTabsInLargeVariantGrid(tabs, {
            tableType: "data-points",
        })

        expect(result).toEqual([
            {
                grapherTab: LineChart,
                slotKey: LeftQuad,
            },
            {
                grapherTab: Table,
                slotKey: RightQuadBottomRow,
            },
            {
                grapherTab: DiscreteBar,
                slotKey: SingleCell,
            },
        ])
    })
})
