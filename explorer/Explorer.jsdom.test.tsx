#! /usr/bin/env jest

import { mount } from "enzyme"
import { Explorer } from "./Explorer"
import { SampleExplorer } from "./Explorer.sample"

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

    it("maintains changed params in url even if a user switches to a chart where the param is the default", () => {
        const explorer = element.instance() as Explorer
        expect(explorer.params.stackMode).toEqual(undefined)
        // todo: add more tests
    })
})
