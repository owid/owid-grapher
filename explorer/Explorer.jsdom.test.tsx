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
        expect(explorer.patchObject.tab).toBeUndefined()

        explorer.onChangeChoice("Gas Radio")("All GHGs (CO₂eq)")

        if (explorer.grapher) explorer.grapher.tab = GrapherTabOption.table
        else throw Error("where's the grapher?")
        expect(explorer.patchObject.tab).toEqual("table")

        explorer.onChangeChoice("Gas Radio")("CO₂")
        expect(explorer.patchObject.tab).toBeUndefined()
    })

    it("recovers country selection from URL params", () => {
        const element = mount(
            SampleExplorer({ uriEncodedPatch: "selection~Ireland" })
        )
        const explorer = element.instance() as Explorer
        expect(explorer.selection.selectedEntityNames).toEqual(["Ireland"])
    })
})
