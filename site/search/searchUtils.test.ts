import { describe, it, expect } from "vitest"
import { GRAPHER_TAB_NAMES } from "@ourworldindata/types"
import { GrapherState } from "@ourworldindata/grapher"
import {
    getSortedGrapherTabsForChartHit,
    placeGrapherTabsInGridLayout,
    GridSlot,
} from "./searchUtils"

describe("getSortedGrapherTabsForChartHit", () => {
    const {
        LineChart,
        Table,
        WorldMap,
        SlopeChart,
        StackedArea,
        DiscreteBar,
        Marimekko,
    } = GRAPHER_TAB_NAMES

    it("should return LineChart/Table/DiscreteBar when GrapherState is initialized with no options", () => {
        const grapherState = new GrapherState({})
        const result = getSortedGrapherTabsForChartHit(grapherState)
        expect(result).toEqual([LineChart, Table, DiscreteBar])
    })

    it("should position WorldMap after LineChart and Table when hasMapTab is true", () => {
        const grapherState = new GrapherState({ hasMapTab: true })
        const result = getSortedGrapherTabsForChartHit(grapherState)
        expect(result).toEqual([LineChart, Table, WorldMap, DiscreteBar])
    })

    it("should show LineChart as first tab even when map is set as default tab", () => {
        const grapherState = new GrapherState({ hasMapTab: true, tab: "map" })
        const result = getSortedGrapherTabsForChartHit(grapherState)
        expect(result).toEqual([LineChart, Table, WorldMap, DiscreteBar])
    })

    it("should show Table when there are no other chart types (edge case)", () => {
        const grapherState = new GrapherState({ chartTypes: [] })
        const result = getSortedGrapherTabsForChartHit(grapherState)
        expect(result).toEqual([Table])
    })

    it("should show WorldMap as first tab when it's the only available chart type", () => {
        const grapherState = new GrapherState({
            chartTypes: [],
            hasMapTab: true,
        })
        const result = getSortedGrapherTabsForChartHit(grapherState)
        expect(result).toEqual([WorldMap, Table])
    })

    it("should prioritise Marimekkos over slope charts", () => {
        const grapherState = new GrapherState({
            chartTypes: [LineChart, SlopeChart, Marimekko],
            hasMapTab: true,
            tab: "slope",
        })
        const result = getSortedGrapherTabsForChartHit(grapherState)
        expect(result).toEqual([
            LineChart,
            Table,
            Marimekko,
            WorldMap,
            SlopeChart,
        ])
    })

    it("drops DiscreteBar if there are too many tabs", () => {
        const grapherState = new GrapherState({
            chartTypes: [LineChart, DiscreteBar, Marimekko, SlopeChart],
            hasMapTab: true,
        })
        const result = getSortedGrapherTabsForChartHit(grapherState)
        expect(result).toEqual([
            LineChart,
            Table,
            Marimekko,
            WorldMap,
            SlopeChart,
        ])
    })

    it("should always show a chart tab in the first position", () => {
        const grapherState = new GrapherState({
            chartTypes: [StackedArea],
            hasMapTab: true,
        })
        const result = getSortedGrapherTabsForChartHit(grapherState)
        expect(result).toEqual([StackedArea, Table, WorldMap])
    })
})

describe("placeGrapherTabsInGridLayout", () => {
    const { LineChart, Table, WorldMap, DiscreteBar, Marimekko } =
        GRAPHER_TAB_NAMES

    describe("when there is no data display on the right", () => {
        it("distributes tabs across 4 available grid slots", () => {
            const tabs = [LineChart, Table, WorldMap, DiscreteBar]
            const result = placeGrapherTabsInGridLayout(tabs, {
                hasDataDisplay: false,
                numDataTableRows: 4,
            })

            expect(result).toEqual([
                { tab: LineChart, slot: GridSlot.SingleSlot },
                { tab: Table, slot: GridSlot.SingleSlot },
                { tab: WorldMap, slot: GridSlot.SingleSlot },
                { tab: DiscreteBar, slot: GridSlot.SingleSlot },
            ])
        })

        it("limits tabs to available grid slots when there are too many", () => {
            const tabs = [LineChart, Table, WorldMap, Marimekko, DiscreteBar]
            const result = placeGrapherTabsInGridLayout(tabs, {
                hasDataDisplay: false,
                numDataTableRows: 2,
            })

            expect(result).toEqual([
                { tab: LineChart, slot: GridSlot.SingleSlot },
                { tab: Table, slot: GridSlot.SingleSlot },
                { tab: WorldMap, slot: GridSlot.SingleSlot },
                { tab: Marimekko, slot: GridSlot.SingleSlot },
            ])
        })

        it("allocates larger slot to Table when it has many rows", () => {
            const tabs = [LineChart, Table, WorldMap]
            const result = placeGrapherTabsInGridLayout(tabs, {
                hasDataDisplay: false,
                numDataTableRows: 12,
            })

            expect(result).toEqual([
                { tab: LineChart, slot: GridSlot.SingleSlot },
                { tab: Table, slot: GridSlot.DoubleSlot },
                { tab: WorldMap, slot: GridSlot.SingleSlot },
            ])
        })

        it("uses single slot for Table when it has few rows", () => {
            const tabs = [LineChart, Table, WorldMap]
            const result = placeGrapherTabsInGridLayout(tabs, {
                hasDataDisplay: false,
                numDataTableRows: 2,
            })

            expect(result).toEqual([
                { tab: LineChart, slot: GridSlot.SingleSlot },
                { tab: Table, slot: GridSlot.SingleSlot },
                { tab: WorldMap, slot: GridSlot.SingleSlot },
            ])
        })

        it("allocates triple slot to Table when it needs more space", () => {
            const tabs = [LineChart, Table]
            const result = placeGrapherTabsInGridLayout(tabs, {
                hasDataDisplay: false,
                numDataTableRows: 20,
            })

            expect(result).toEqual([
                { tab: LineChart, slot: GridSlot.SingleSlot },
                { tab: Table, slot: GridSlot.TripleSlot },
            ])
        })

        it("should handle single tab case", () => {
            const tabs = [Table]
            const result = placeGrapherTabsInGridLayout(tabs, {
                hasDataDisplay: false,
                numDataTableRows: 6,
            })

            expect(result).toEqual([{ tab: Table, slot: GridSlot.DoubleSlot }])
        })

        it("should give Table the maximum available space when needed", () => {
            const tabs = [Table]
            const result = placeGrapherTabsInGridLayout(tabs, {
                hasDataDisplay: false,
                numDataTableRows: 18,
            })

            expect(result).toEqual([{ tab: Table, slot: GridSlot.QuadSlot }])
        })
    })

    describe("when there is a data display on the right", () => {
        it("places first 3 tabs in main slots and remaining tabs in small slots", () => {
            const tabs = [LineChart, Table, Marimekko, WorldMap, DiscreteBar]
            const result = placeGrapherTabsInGridLayout(tabs, {
                hasDataDisplay: true,
                numDataTableRows: 12,
            })

            expect(result).toEqual([
                { tab: LineChart, slot: GridSlot.SingleSlot },
                { tab: Table, slot: GridSlot.SingleSlot },
                { tab: Marimekko, slot: GridSlot.SingleSlot },
                { tab: WorldMap, slot: GridSlot.SmallSlotLeft },
                { tab: DiscreteBar, slot: GridSlot.SmallSlotRight },
            ])
        })

        it("uses only main slots when 3 or fewer tabs are provided", () => {
            const tabs = [LineChart, Table, WorldMap]
            const result = placeGrapherTabsInGridLayout(tabs, {
                hasDataDisplay: true,
                numDataTableRows: 16,
            })

            expect(result).toEqual([
                { tab: LineChart, slot: GridSlot.SingleSlot },
                { tab: Table, slot: GridSlot.SingleSlot },
                { tab: WorldMap, slot: GridSlot.SingleSlot },
            ])
        })

        it("should allocate two slots to Table if possible", () => {
            const tabs = [LineChart, Table]
            const result = placeGrapherTabsInGridLayout(tabs, {
                hasDataDisplay: true,
                numDataTableRows: 16,
            })

            expect(result).toEqual([
                { tab: LineChart, slot: GridSlot.SingleSlot },
                { tab: Table, slot: GridSlot.DoubleSlot },
            ])
        })
    })
})
