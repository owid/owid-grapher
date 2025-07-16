import { expect, it, describe } from "vitest"

import { Explorer } from "./Explorer.js"
import {
    SampleExplorerOfGraphers,
    SampleInlineDataExplorer,
} from "./Explorer.sample.js"

import { GRAPHER_TAB_CONFIG_OPTIONS } from "@ourworldindata/types"

describe(Explorer, () => {
    it("preserves the current tab between explorer views", () => {
        const explorer = SampleExplorerOfGraphers()

        expect(explorer.queryParams.tab).toBeUndefined()

        explorer.onChangeChoice("Gas")("All GHGs (CO₂eq)")

        if (explorer.grapher?.grapherState)
            explorer.grapher.grapherState.tab = GRAPHER_TAB_CONFIG_OPTIONS.table
        else throw Error("where's the grapher?")
        expect(explorer.queryParams.tab).toEqual("table")

        explorer.onChangeChoice("Gas")("CO₂")
        expect(explorer.queryParams.tab).toEqual("table")

        explorer.grapher.grapherState.tab = GRAPHER_TAB_CONFIG_OPTIONS.chart
    })

    it("switches to first tab if current tab does not exist in new view", () => {
        const explorer = SampleExplorerOfGraphers()

        expect(explorer.queryParams.tab).toBeUndefined()
        if (explorer.grapher?.grapherState)
            explorer.grapher.grapherState.tab = GRAPHER_TAB_CONFIG_OPTIONS.map
        else throw Error("where's the grapher?")
        // expect(explorer.queryParams.tab).toEqual("map")

        explorer.onChangeChoice("Gas")("All GHGs (CO₂eq)")

        expect(explorer.grapher?.grapherState.tab).toEqual("line")
        expect(explorer.queryParams.tab).toEqual(undefined)
    })

    it("recovers country selection from URL params", () => {
        const explorer = SampleExplorerOfGraphers({
            queryStr: "?country=IRL",
        })

        explorer.componentDidMount()

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
    it("clears column slugs that don't exist in current row", () => {
        const explorer = SampleInlineDataExplorer()
        explorer.onChangeChoice("Test")("Line")
        expect(explorer.queryParams).toMatchObject({
            Test: "Line",
        })
        expect(explorer.grapher?.grapherState?.xSlug).toEqual(undefined)
        expect(explorer.grapher?.grapherState?.ySlugs).toEqual("y")
        expect(explorer.grapher?.grapherState?.colorSlug).toEqual(undefined)
        expect(explorer.grapher?.grapherState?.sizeSlug).toEqual(undefined)
    })
})
