import * as React from "react"
import { Grapher, GrapherProgrammaticInterface } from "./Grapher"
import { SampleColumnSlugs, SynthesizeGDPTable } from "coreTable/OwidTable"
import { DimensionProperty } from "./GrapherConstants"

export default {
    title: "Grapher",
    component: Grapher,
}

const props: GrapherProgrammaticInterface = {
    table: SynthesizeGDPTable().selectSample(3),
    hasMapTab: true,
    dimensions: [
        {
            slug: SampleColumnSlugs.GDP,
            property: DimensionProperty.y,
            variableId: 1,
        },
    ],
}

export const Default = () => <Grapher {...props} />
