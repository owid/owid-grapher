#! yarn testJest

import { Explorer } from "./Explorer"
import { SampleExplorer } from "./Explorer.sample"

import { configure, mount } from "enzyme"
import Adapter from "enzyme-adapter-react-16"
import { GrapherTabOption } from "../grapher/core/GrapherConstants"
configure({ adapter: new Adapter() })

describe(Explorer, () => {
    const title = "AlphaBeta"
    const element = mount(SampleExplorer())
    it("renders", () => {
        expect(element.find(".ExplorerHeaderBox").text()).toContain(
            "CO₂ Data Explorer"
        )
        expect(element.find(`.HeaderHTML`).text()).toContain(title)
        expect(element.find(`.loading-indicator`).length).toEqual(0)
        expect(element.text()).toContain("Kingdom")
    })

    it("each grapher has its own set of URL params/options are preserved even when the grapher changes", () => {
        const explorer = element.instance() as Explorer
        expect(explorer.queryParams.tab).toBeUndefined()

        explorer.onChangeChoice("Gas")("All GHGs (CO₂eq)")

        if (explorer.grapher) explorer.grapher.tab = GrapherTabOption.table
        else throw Error("where's the grapher?")
        expect(explorer.queryParams.tab).toEqual("table")

        explorer.onChangeChoice("Gas")("CO₂")
        expect(explorer.queryParams.tab).toBeUndefined()
    })

    it("recovers country selection from URL params", () => {
        const element = mount(SampleExplorer({ queryStr: "?selection=IRL" }))
        const explorer = element.instance() as Explorer
        expect(explorer.selection.selectedEntityNames).toEqual(["Ireland"])
    })

    it("serializes all choice params in URL", () => {
        const element = mount(SampleExplorer())
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
