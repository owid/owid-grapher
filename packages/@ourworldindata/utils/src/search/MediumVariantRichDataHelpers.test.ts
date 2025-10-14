import { describe, it, expect } from "vitest"
import {
    GRAPHER_TAB_NAMES,
    MediumVariantGridSlotKey,
} from "@ourworldindata/types"
import { placeGrapherTabsInMediumVariantGridLayout } from "./MediumVariantRichDataHelpers.js"

const { Single, Double, Triple, Quad, SmallLeft, SmallRight } =
    MediumVariantGridSlotKey

describe(placeGrapherTabsInMediumVariantGridLayout, () => {
    const { LineChart, Table, WorldMap, DiscreteBar, Marimekko } =
        GRAPHER_TAB_NAMES

    describe("when there is no data display on the right", () => {
        it("distributes tabs across 4 available grid slots", () => {
            const tabs = [LineChart, Table, WorldMap, DiscreteBar]
            const result = placeGrapherTabsInMediumVariantGridLayout(tabs, {
                hasDataTable: true,
                hasDataDisplay: false,
                numDataTableRows: 4,
                numDataTableRowsPerColumn: 4,
            })

            expect(result).toEqual([
                {
                    grapherTab: LineChart,
                    slotKey: Single,
                },
                { grapherTab: Table, slotKey: Single },
                {
                    grapherTab: WorldMap,
                    slotKey: Single,
                },
                {
                    grapherTab: DiscreteBar,
                    slotKey: Single,
                },
            ])
        })

        it("limits tabs to available grid slots when there are too many", () => {
            const tabs = [LineChart, Table, WorldMap, Marimekko, DiscreteBar]
            const result = placeGrapherTabsInMediumVariantGridLayout(tabs, {
                hasDataTable: true,
                hasDataDisplay: false,
                numDataTableRows: 2,
                numDataTableRowsPerColumn: 4,
            })

            expect(result).toEqual([
                {
                    grapherTab: LineChart,
                    slotKey: Single,
                },
                { grapherTab: Table, slotKey: Single },
                {
                    grapherTab: WorldMap,
                    slotKey: Single,
                },
                {
                    grapherTab: Marimekko,
                    slotKey: Single,
                },
            ])
        })

        it("allocates larger slot to Table when it has many rows", () => {
            const tabs = [LineChart, Table, WorldMap]
            const result = placeGrapherTabsInMediumVariantGridLayout(tabs, {
                hasDataTable: true,
                hasDataDisplay: false,
                numDataTableRows: 12,
                numDataTableRowsPerColumn: 4,
            })

            expect(result).toEqual([
                {
                    grapherTab: LineChart,
                    slotKey: Single,
                },
                { grapherTab: Table, slotKey: Double },
                {
                    grapherTab: WorldMap,
                    slotKey: Single,
                },
            ])
        })

        it("uses single slot for Table when it has few rows", () => {
            const tabs = [LineChart, Table, WorldMap]
            const result = placeGrapherTabsInMediumVariantGridLayout(tabs, {
                hasDataTable: true,
                hasDataDisplay: false,
                numDataTableRows: 2,
                numDataTableRowsPerColumn: 4,
            })

            expect(result).toEqual([
                {
                    grapherTab: LineChart,
                    slotKey: Single,
                },
                { grapherTab: Table, slotKey: Single },
                {
                    grapherTab: WorldMap,
                    slotKey: Single,
                },
            ])
        })

        it("allocates triple slot to Table when it needs more space", () => {
            const tabs = [LineChart, Table]
            const result = placeGrapherTabsInMediumVariantGridLayout(tabs, {
                hasDataTable: true,
                hasDataDisplay: false,
                numDataTableRows: 20,
                numDataTableRowsPerColumn: 4,
            })

            expect(result).toEqual([
                {
                    grapherTab: LineChart,
                    slotKey: Single,
                },
                { grapherTab: Table, slotKey: Triple },
            ])
        })

        it("should handle single tab case", () => {
            const tabs = [Table]
            const result = placeGrapherTabsInMediumVariantGridLayout(tabs, {
                hasDataTable: true,
                hasDataDisplay: false,
                numDataTableRows: 6,
                numDataTableRowsPerColumn: 4,
            })

            expect(result).toEqual([{ grapherTab: Table, slotKey: Double }])
        })

        it("should give Table the maximum available space when needed", () => {
            const tabs = [Table]
            const result = placeGrapherTabsInMediumVariantGridLayout(tabs, {
                hasDataTable: true,
                hasDataDisplay: false,
                numDataTableRows: 18,
                numDataTableRowsPerColumn: 4,
            })

            expect(result).toEqual([{ grapherTab: Table, slotKey: Quad }])
        })

        it("drops the DiscreteBar tab in favour of a wider table", () => {
            const tabs = [LineChart, Table, WorldMap, DiscreteBar]
            const result = placeGrapherTabsInMediumVariantGridLayout(tabs, {
                hasDataTable: true,
                hasDataDisplay: false,
                numDataTableRows: 6,
                numDataTableRowsPerColumn: 4,
                prioritizeTableOverDiscreteBar: true,
            })

            expect(result).toEqual([
                {
                    grapherTab: LineChart,
                    slotKey: Single,
                },
                { grapherTab: Table, slotKey: Double },
                {
                    grapherTab: WorldMap,
                    slotKey: Single,
                },
            ])
        })
    })

    describe("when there is a data display on the right", () => {
        it("places first 3 tabs in main slots and remaining tabs in small slots", () => {
            const tabs = [LineChart, Table, Marimekko, WorldMap, DiscreteBar]
            const result = placeGrapherTabsInMediumVariantGridLayout(tabs, {
                hasDataTable: true,
                hasDataDisplay: true,
                numDataTableRows: 12,
                numDataTableRowsPerColumn: 4,
            })

            expect(result).toEqual([
                {
                    grapherTab: LineChart,
                    slotKey: Single,
                },
                { grapherTab: Table, slotKey: Single },
                {
                    grapherTab: Marimekko,
                    slotKey: Single,
                },
                {
                    grapherTab: WorldMap,
                    slotKey: SmallLeft,
                },
                {
                    grapherTab: DiscreteBar,
                    slotKey: SmallRight,
                },
            ])
        })

        it("uses only main slots when 3 or fewer tabs are provided", () => {
            const tabs = [LineChart, Table, WorldMap]
            const result = placeGrapherTabsInMediumVariantGridLayout(tabs, {
                hasDataTable: true,
                hasDataDisplay: true,
                numDataTableRows: 16,
                numDataTableRowsPerColumn: 4,
            })

            expect(result).toEqual([
                {
                    grapherTab: LineChart,
                    slotKey: Single,
                },
                { grapherTab: Table, slotKey: Single },
                {
                    grapherTab: WorldMap,
                    slotKey: Single,
                },
            ])
        })

        it("should allocate two slots to Table if possible", () => {
            const tabs = [LineChart, Table]
            const result = placeGrapherTabsInMediumVariantGridLayout(tabs, {
                hasDataTable: true,
                hasDataDisplay: true,
                numDataTableRows: 16,
                numDataTableRowsPerColumn: 4,
            })

            expect(result).toEqual([
                {
                    grapherTab: LineChart,
                    slotKey: Single,
                },
                { grapherTab: Table, slotKey: Double },
            ])
        })

        it("assigns a small slot to the DiscreteBar tab in favour of a wider table", () => {
            const tabs = [LineChart, Table, DiscreteBar]
            const result = placeGrapherTabsInMediumVariantGridLayout(tabs, {
                hasDataTable: true,
                hasDataDisplay: true,
                numDataTableRows: 6,
                numDataTableRowsPerColumn: 4,
                prioritizeTableOverDiscreteBar: true,
            })

            expect(result).toEqual([
                {
                    grapherTab: LineChart,
                    slotKey: Single,
                },
                { grapherTab: Table, slotKey: Double },
                {
                    grapherTab: DiscreteBar,
                    slotKey: SmallLeft,
                },
            ])
        })
    })
})
