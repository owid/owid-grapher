#! yarn testJest

import { Explorer } from "./Explorer.js"
import {
    SampleExplorerOfGraphers,
    SampleInlineDataExplorer,
} from "./Explorer.sample.js"

import enzyme from "enzyme"
import Adapter from "enzyme-adapter-react-16"
import { GrapherTabOption } from "../grapher/core/GrapherConstants.js"

enzyme.configure({ adapter: new Adapter() })

describe(Explorer, () => {
    const title = "AlphaBeta"
    const element = enzyme.mount(SampleExplorerOfGraphers())
    it("renders", () => {
        expect(element.find(".ExplorerHeaderBox").text()).toContain(
            "CO₂ Data Explorer"
        )
        expect(element.find(`.HeaderHTML`).text()).toContain(title)
        expect(element.find(`.loading-indicator`).length).toEqual(0)
        expect(element.text()).toContain("Kingdom")
    })

    it("preserves the current tab between explorer views", () => {
        const explorer = element.instance() as Explorer
        expect(explorer.queryParams.tab).toBeUndefined()

        explorer.onChangeChoice("Gas")("All GHGs (CO₂eq)")

        if (explorer.grapher) explorer.grapher.tab = GrapherTabOption.table
        else throw Error("where's the grapher?")
        expect(explorer.queryParams.tab).toEqual("table")

        explorer.onChangeChoice("Gas")("CO₂")
        expect(explorer.queryParams.tab).toEqual("table")

        explorer.grapher.tab = GrapherTabOption.chart
    })

    it("switches to first tab if current tab does not exist in new view", () => {
        const explorer = element.instance() as Explorer
        expect(explorer.queryParams.tab).toBeUndefined()
        if (explorer.grapher) explorer.grapher.tab = GrapherTabOption.map
        else throw Error("where's the grapher?")
        expect(explorer.queryParams.tab).toEqual("map")

        explorer.onChangeChoice("Gas")("All GHGs (CO₂eq)")

        expect(explorer.grapher.tab).toEqual("chart")
        expect(explorer.queryParams.tab).toEqual(undefined)
    })

    it("recovers country selection from URL params", () => {
        const element = enzyme.mount(
            SampleExplorerOfGraphers({ queryStr: "?country=IRL" })
        )
        const explorer = element.instance() as Explorer
        expect(explorer.selection.selectedEntityNames).toEqual(["Ireland"])
    })

    it("serializes all choice params in URL", () => {
        const element = enzyme.mount(SampleExplorerOfGraphers())
        const explorer = element.instance() as Explorer
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
    const element = enzyme.mount(SampleInlineDataExplorer())
    const explorer = element.instance() as Explorer

    it("renders", () => {
        expect(element.find(".ExplorerHeaderBox").text()).toContain(
            "Sample Explorer"
        )
        expect(explorer.queryParams).toMatchObject({
            Test: "Scatter",
        })
        expect(explorer.grapher?.xSlug).toEqual("x")
        expect(explorer.grapher?.ySlugs).toEqual("y")
        expect(explorer.grapher?.colorSlug).toEqual("color")
        expect(explorer.grapher?.sizeSlug).toEqual("size")
    })

    it("clears column slugs that don't exist in current row", () => {
        explorer.onChangeChoice("Test")("Line")
        expect(explorer.queryParams).toMatchObject({
            Test: "Line",
        })
        expect(explorer.grapher?.xSlug).toEqual(undefined)
        expect(explorer.grapher?.ySlugs).toEqual("y")
        expect(explorer.grapher?.colorSlug).toEqual(undefined)
        expect(explorer.grapher?.sizeSlug).toEqual(undefined)
    })
})
