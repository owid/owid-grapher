import { expect, it, describe } from "vitest"

import { Explorer } from "./Explorer.js"
import {
    SampleExplorerOfGraphers,
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
