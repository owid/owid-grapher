#! /usr/bin/env jest

import { mount } from "enzyme"
import React from "react"
import { Grapher, GrapherProgrammaticInterface } from "grapher/core/Grapher"
import {
    SampleColumnSlugs,
    SynthesizeGDPTable,
} from "coreTable/OwidTableSynthesizers"
import { DimensionProperty } from "grapher/core/GrapherConstants"

const TestGrapherConfig = () => {
    const table = SynthesizeGDPTable({ entityCount: 10 })
    return {
        table,
        selectedEntityNames: table.sampleEntityName(5),
        dimensions: [
            {
                slug: SampleColumnSlugs.GDP,
                property: DimensionProperty.y,
                variableId: SampleColumnSlugs.GDP as any,
            },
        ],
    } as GrapherProgrammaticInterface
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
