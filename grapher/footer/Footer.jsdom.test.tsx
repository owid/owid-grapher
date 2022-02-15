#! /usr/bin/env jest

import React from "react"
import { Grapher, GrapherProgrammaticInterface } from "../core/Grapher.js"
import {
    SampleColumnSlugs,
    SynthesizeGDPTable,
} from "../../coreTable/OwidTableSynthesizers.js"

import enzyme from "enzyme"
import Adapter from "enzyme-adapter-react-16"
import { DimensionProperty } from "../../clientUtils/owidTypes.js"
enzyme.configure({ adapter: new Adapter() })

const TestGrapherConfig = (): GrapherProgrammaticInterface => {
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
    const mountedGrapher = enzyme.mount(<Grapher {...TestGrapherConfig} />)
    expect(mountedGrapher.find(".sourcesTab")).toHaveLength(0)
    expect(mountedGrapher.find(".SourcesFooterHTML")).toHaveLength(1)

    const mountedGrapherPostClick = mountedGrapher
        .find(".SourcesFooterHTML")
        .find(".clickable")
        .simulate("click")
        .update()

    expect(mountedGrapherPostClick.find(".sourcesTab")).toHaveLength(1)
})
