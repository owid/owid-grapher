#! /usr/bin/env yarn jest

import { mount } from "enzyme"
import React from "react"
import { Grapher, TestGrapherConfig } from "grapher/core/Grapher"

test("clicking the sources footer changes tabs", () => {
    const mountedGrapher = mount(<Grapher {...TestGrapherConfig} />)
    expect(mountedGrapher.find(".sourcesTab")).toHaveLength(0)
    expect(mountedGrapher.find(".SourcesFooterHTML")).toHaveLength(1)

    const mountedGrapherPostClick = mountedGrapher
        .find(".SourcesFooterHTML")
        .find(".clickable")
        .simulate("click")
        .update()

    expect(mountedGrapherPostClick.find(".sourcesTab")).toHaveLength(1)
})
