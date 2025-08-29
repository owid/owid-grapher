import { describe, it, expect } from "vitest"
import { GRAPHER_TAB_NAMES } from "@ourworldindata/types"
import { MediumVariantGridSlot } from "./SearchChartHitRichDataTypes.js"
import { placeGrapherTabsInMediumVariantGridLayout } from "./SearchChartHitRichDataMediumVariantHelpers.js"

describe(placeGrapherTabsInMediumVariantGridLayout, () => {
    const { LineChart, Table, WorldMap, DiscreteBar, Marimekko } =
        GRAPHER_TAB_NAMES

    describe("when there is no data display on the right", () => {
        it("distributes tabs across 4 available grid slots", () => {
            const tabs = [LineChart, Table, WorldMap, DiscreteBar]
            const result = placeGrapherTabsInMediumVariantGridLayout(tabs, {
                tableType: "data-table",
                hasDataDisplay: false,
                numDataTableRows: 4,
                numDataTableRowsPerColumn: 4,
            })

            expect(result).toEqual([
                { tab: LineChart, slot: MediumVariantGridSlot.Single },
                { tab: Table, slot: MediumVariantGridSlot.Single },
                { tab: WorldMap, slot: MediumVariantGridSlot.Single },
                { tab: DiscreteBar, slot: MediumVariantGridSlot.Single },
            ])
        })

        it("limits tabs to available grid slots when there are too many", () => {
            const tabs = [LineChart, Table, WorldMap, Marimekko, DiscreteBar]
            const result = placeGrapherTabsInMediumVariantGridLayout(tabs, {
                tableType: "data-table",
                hasDataDisplay: false,
                numDataTableRows: 2,
                numDataTableRowsPerColumn: 4,
            })

            expect(result).toEqual([
                { tab: LineChart, slot: MediumVariantGridSlot.Single },
                { tab: Table, slot: MediumVariantGridSlot.Single },
                { tab: WorldMap, slot: MediumVariantGridSlot.Single },
                { tab: Marimekko, slot: MediumVariantGridSlot.Single },
            ])
        })

        it("allocates larger slot to Table when it has many rows", () => {
            const tabs = [LineChart, Table, WorldMap]
            const result = placeGrapherTabsInMediumVariantGridLayout(tabs, {
                tableType: "data-table",
                hasDataDisplay: false,
                numDataTableRows: 12,
                numDataTableRowsPerColumn: 4,
            })

            expect(result).toEqual([
                { tab: LineChart, slot: MediumVariantGridSlot.Single },
                { tab: Table, slot: MediumVariantGridSlot.Double },
                { tab: WorldMap, slot: MediumVariantGridSlot.Single },
            ])
        })

        it("uses single slot for Table when it has few rows", () => {
            const tabs = [LineChart, Table, WorldMap]
            const result = placeGrapherTabsInMediumVariantGridLayout(tabs, {
                tableType: "data-table",
                hasDataDisplay: false,
                numDataTableRows: 2,
                numDataTableRowsPerColumn: 4,
            })

            expect(result).toEqual([
                { tab: LineChart, slot: MediumVariantGridSlot.Single },
                { tab: Table, slot: MediumVariantGridSlot.Single },
                { tab: WorldMap, slot: MediumVariantGridSlot.Single },
            ])
        })

        it("allocates triple slot to Table when it needs more space", () => {
            const tabs = [LineChart, Table]
            const result = placeGrapherTabsInMediumVariantGridLayout(tabs, {
                tableType: "data-table",
                hasDataDisplay: false,
                numDataTableRows: 20,
                numDataTableRowsPerColumn: 4,
            })

            expect(result).toEqual([
                { tab: LineChart, slot: MediumVariantGridSlot.Single },
                { tab: Table, slot: MediumVariantGridSlot.Triple },
            ])
        })

        it("should respect the given number of max slots for the table", () => {
            const tabs = [LineChart, Table]
            const result = placeGrapherTabsInMediumVariantGridLayout(tabs, {
                tableType: "data-points",
                hasDataDisplay: false,
                numMaxSlotsForTable: 2,
            })

            expect(result).toEqual([
                { tab: LineChart, slot: MediumVariantGridSlot.Single },
                { tab: Table, slot: MediumVariantGridSlot.Double },
            ])
        })

        it("should handle single tab case", () => {
            const tabs = [Table]
            const result = placeGrapherTabsInMediumVariantGridLayout(tabs, {
                tableType: "data-table",
                hasDataDisplay: false,
                numDataTableRows: 6,
                numDataTableRowsPerColumn: 4,
            })

            expect(result).toEqual([
                { tab: Table, slot: MediumVariantGridSlot.Double },
            ])
        })

        it("should give Table the maximum available space when needed", () => {
            const tabs = [Table]
            const result = placeGrapherTabsInMediumVariantGridLayout(tabs, {
                tableType: "data-table",
                hasDataDisplay: false,
                numDataTableRows: 18,
                numDataTableRowsPerColumn: 4,
            })

            expect(result).toEqual([
                { tab: Table, slot: MediumVariantGridSlot.Quad },
            ])
        })

        it("drops the DiscreteBar tab in favour of a wider table", () => {
            const tabs = [LineChart, Table, WorldMap, DiscreteBar]
            const result = placeGrapherTabsInMediumVariantGridLayout(tabs, {
                tableType: "data-table",
                hasDataDisplay: false,
                numDataTableRows: 6,
                numDataTableRowsPerColumn: 4,
                prioritizeTableOverDiscreteBar: true,
            })

            expect(result).toEqual([
                { tab: LineChart, slot: MediumVariantGridSlot.Single },
                { tab: Table, slot: MediumVariantGridSlot.Double },
                { tab: WorldMap, slot: MediumVariantGridSlot.Single },
            ])
        })
    })

    describe("when there is a data display on the right", () => {
        it("places first 3 tabs in main slots and remaining tabs in small slots", () => {
            const tabs = [LineChart, Table, Marimekko, WorldMap, DiscreteBar]
            const result = placeGrapherTabsInMediumVariantGridLayout(tabs, {
                tableType: "data-table",
                hasDataDisplay: true,
                numDataTableRows: 12,
                numDataTableRowsPerColumn: 4,
            })

            expect(result).toEqual([
                { tab: LineChart, slot: MediumVariantGridSlot.Single },
                { tab: Table, slot: MediumVariantGridSlot.Single },
                { tab: Marimekko, slot: MediumVariantGridSlot.Single },
                { tab: WorldMap, slot: MediumVariantGridSlot.SmallLeft },
                { tab: DiscreteBar, slot: MediumVariantGridSlot.SmallRight },
            ])
        })

        it("uses only main slots when 3 or fewer tabs are provided", () => {
            const tabs = [LineChart, Table, WorldMap]
            const result = placeGrapherTabsInMediumVariantGridLayout(tabs, {
                tableType: "data-table",
                hasDataDisplay: true,
                numDataTableRows: 16,
                numDataTableRowsPerColumn: 4,
            })

            expect(result).toEqual([
                { tab: LineChart, slot: MediumVariantGridSlot.Single },
                { tab: Table, slot: MediumVariantGridSlot.Single },
                { tab: WorldMap, slot: MediumVariantGridSlot.Single },
            ])
        })

        it("should allocate two slots to Table if possible", () => {
            const tabs = [LineChart, Table]
            const result = placeGrapherTabsInMediumVariantGridLayout(tabs, {
                tableType: "data-table",
                hasDataDisplay: true,
                numDataTableRows: 16,
                numDataTableRowsPerColumn: 4,
            })

            expect(result).toEqual([
                { tab: LineChart, slot: MediumVariantGridSlot.Single },
                { tab: Table, slot: MediumVariantGridSlot.Double },
            ])
        })

        it("should respect the given number of max slots for the table", () => {
            const tabs = [LineChart, Table]
            const result = placeGrapherTabsInMediumVariantGridLayout(tabs, {
                tableType: "data-points",
                hasDataDisplay: true,
                numMaxSlotsForTable: 1,
            })

            expect(result).toEqual([
                { tab: LineChart, slot: MediumVariantGridSlot.Single },
                { tab: Table, slot: MediumVariantGridSlot.Single },
            ])
        })

        it("assigns a small slot to the DiscreteBar tab in favour of a wider table", () => {
            const tabs = [LineChart, Table, DiscreteBar]
            const result = placeGrapherTabsInMediumVariantGridLayout(tabs, {
                tableType: "data-table",
                hasDataDisplay: true,
                numDataTableRows: 6,
                numDataTableRowsPerColumn: 4,
                prioritizeTableOverDiscreteBar: true,
            })

            expect(result).toEqual([
                { tab: LineChart, slot: MediumVariantGridSlot.Single },
                { tab: Table, slot: MediumVariantGridSlot.Double },
                { tab: DiscreteBar, slot: MediumVariantGridSlot.SmallLeft },
            ])
        })
    })
})
