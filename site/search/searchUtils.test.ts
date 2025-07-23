import { describe, it, expect } from "vitest"
import { GRAPHER_TAB_NAMES } from "@ourworldindata/types"
import { GrapherState } from "@ourworldindata/grapher"
import { getSortedGrapherTabsForChartHit } from "./searchUtils"

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
