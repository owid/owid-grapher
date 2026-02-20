import { expect, it, describe } from "vitest"

import { Explorer } from "./Explorer.js"
import {
    SampleExplorerOfGraphers,
    SampleIndicatorBasedExplorer,
    SampleInlineDataExplorer,
} from "./Explorer.sample.js"

import { GRAPHER_TAB_CONFIG_OPTIONS } from "@ourworldindata/types"

describe(Explorer, () => {
    it("preserves the current tab between explorer views", async () => {
        const explorer = SampleExplorerOfGraphers()

        expect(explorer.queryParams.tab).toBeUndefined()

        await explorer.onChangeChoice("Gas")("All GHGs (CO₂eq)")

        explorer.grapherState.tab = GRAPHER_TAB_CONFIG_OPTIONS.table
        expect(explorer.queryParams.tab).toEqual("table")

        await explorer.onChangeChoice("Gas")("CO₂")
        expect(explorer.queryParams.tab).toEqual("table")

        explorer.grapherState.tab = GRAPHER_TAB_CONFIG_OPTIONS.chart
    })

    it("switches to first tab if current tab does not exist in new view", async () => {
        const explorer = SampleExplorerOfGraphers()

        expect(explorer.queryParams.tab).toBeUndefined()
        explorer.grapherState.tab = GRAPHER_TAB_CONFIG_OPTIONS.map
        // expect(explorer.queryParams.tab).toEqual("map")

        await explorer.onChangeChoice("Gas")("All GHGs (CO₂eq)")

        expect(explorer.grapherState.tab).toEqual("line")
        expect(explorer.queryParams.tab).toEqual(undefined)
    })

    it("recovers country selection from URL params", async () => {
        const explorer = SampleExplorerOfGraphers({
            queryStr: "?country=IRL",
        })

        await explorer.componentDidMount()

        expect(explorer.selection.selectedEntityNames).toEqual(["Ireland"])
    })

    it("serializes all choice params in URL", () => {
        const explorer = SampleExplorerOfGraphers()

        expect(explorer.queryParams).toMatchObject({
            Accounting: "Production-based",
            Count: "Per country",
            Fuel: "Total",
            Gas: "CO₂",
            "Relative to world total": "false",
        })
    })

    it("resolves query params when URL requests unavailable choice combination", () => {
        // "Consumption-based" accounting is only available for CO₂,
        // so requesting it for Methane should fall back to "Production-based"
        const explorer = SampleExplorerOfGraphers({
            queryStr: "?Gas=Methane&Accounting=Consumption-based",
        })

        expect(explorer.queryParams).toMatchObject({
            Gas: "Methane",
            Accounting: "Production-based",
        })
    })

    it("resolves query params to first available option when URL contains invalid choice value", () => {
        const explorer = SampleExplorerOfGraphers({
            queryStr: "?Gas=InvalidGas",
        })

        // "InvalidGas" doesn't exist, so it should fall back to the
        // first available option "CO₂"
        expect(explorer.queryParams.Gas).toEqual("CO₂")
    })

    it("includes country param in archived embed URL after switching views", async () => {
        const explorer = SampleExplorerOfGraphers({
            queryStr: "?country=~GBR",
            archiveContext: {
                type: "archived-page-version",
                archiveUrl: "https://archive.org/example",
                archivalDate: "20240101-000000",
            },
        })

        await explorer.componentDidMount()

        // Verify initial state has country param
        const initialUrl = explorer.grapherState.embedArchivedUrl
        expect(initialUrl).toContain("country=~GBR")

        // Switch to a different view
        await explorer.onChangeChoice("Gas")("All GHGs (CO₂eq)")

        // Verify country param is still present after switching
        const afterSwitchUrl = explorer.grapherState.embedArchivedUrl
        expect(afterSwitchUrl).toContain("country=~GBR")
    })
})

describe("inline data explorer", () => {
    it("clears column slugs that don't exist in current row", async () => {
        const explorer = SampleInlineDataExplorer()
        await explorer.onChangeChoice("Test")("Line")
        expect(explorer.queryParams).toMatchObject({
            Test: "Line",
        })
        expect(explorer.grapherState?.xSlug).toEqual(undefined)
        expect(explorer.grapherState?.ySlugs).toEqual("y")
        expect(explorer.grapherState?.colorSlug).toEqual(undefined)
        expect(explorer.grapherState?.sizeSlug).toEqual(undefined)
    })
})

describe("indicator-based explorer", () => {
    it("adds variable ids to the dimensions array", async () => {
        const explorer = SampleIndicatorBasedExplorer()
        await explorer.onChangeChoice("Test")("Indicator id based")
        expect(explorer.grapherState.yColumnSlugs).toEqual(["952182"])
        expect(explorer.grapherState.object.dimensions).toEqual([
            {
                property: "y",
                variableId: 952182,
                display: { name: "Variable name", shortUnit: "tons" },
            },
        ])
    })

    it("adds variable ids to the dimensions array for transformed columns", async () => {
        const explorer = SampleIndicatorBasedExplorer()
        await explorer.onChangeChoice("Test")("Slug based")
        expect(explorer.grapherState.yColumnSlugs).toEqual(["duplicated"])
        expect(explorer.grapherState.object.dimensions).toEqual([
            {
                property: "y",
                variableId: 952182,
                display: { name: "Overwritten name", unit: "people" },
            },
        ])
    })
})
