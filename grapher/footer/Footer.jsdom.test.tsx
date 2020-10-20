#! /usr/bin/env yarn jest

import { mount } from "enzyme"
import React from "react"
import { Grapher } from "grapher/core/Grapher"
import {
    SampleColumnSlugs,
    SynthesizeGDPTable,
} from "coreTable/OwidTableSynthesizers"
import { DimensionProperty } from "grapher/core/GrapherConstants"

const TestGrapherConfig = () => {
    return {
        table: SynthesizeGDPTable({ entityCount: 10 }).selectSample(5),
        dimensions: [
            {
                slug: SampleColumnSlugs.GDP,
                property: DimensionProperty.y,
                variableId: SampleColumnSlugs.GDP as any,
            },
        ],
    }
}

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
