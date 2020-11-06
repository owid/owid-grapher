#! /usr/bin/env yarn jest

import { mount } from "enzyme"
import { SampleExplorer } from "./Explorer.sample"

it("renders the Explorer", async () => {
    const title = "AlphaBeta"
    const element = mount(SampleExplorer())
    expect(element.find(".ExplorerHeaderBox").text()).toContain(
        "CO₂ Data Explorer"
    )
    expect(element.find(`.HeaderHTML`).text()).toContain(title)
    expect(element.find(`.loading-indicator`).length).toEqual(0)
    expect(element.text()).toContain("Kingdom")
})
