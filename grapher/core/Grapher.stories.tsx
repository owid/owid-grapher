import * as React from "react"
import { Grapher, GrapherProgrammaticInterface } from "./Grapher"
import { SampleColumnSlugs, SynthesizeGDPTable } from "coreTable/OwidTable"
import { DimensionProperty } from "./GrapherConstants"

export default {
    title: "Grapher",
    component: Grapher,
}

const props: GrapherProgrammaticInterface = {
    table: SynthesizeGDPTable({ entityCount: 10 }).selectSample(5),
    hasMapTab: true,
    enableKeyboardShortcuts: true,
    dimensions: [
        {
            slug: SampleColumnSlugs.GDP,
            property: DimensionProperty.y,
            variableId: SampleColumnSlugs.GDP as any,
        },
    ],
}

export const Default = () => <Grapher {...props} />
