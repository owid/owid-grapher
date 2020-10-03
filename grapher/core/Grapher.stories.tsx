import * as React from "react"
import { Grapher, GrapherProgrammaticInterface } from "./Grapher"
import { SynthesizeGDPTable } from "coreTable/OwidTable"
import { ChartTypeName, DimensionProperty } from "./GrapherConstants"

export default {
    title: "Grapher",
    component: Grapher,
}

const table = SynthesizeGDPTable()

const props: GrapherProgrammaticInterface = {
    table,
    hasMapTab: true,
    dimensions: [{ slug: "GDP", property: DimensionProperty.y, variableId: 1 }],
    type: ChartTypeName.LineChart,
}

table.selectAll()

export const Default = () => <Grapher {...props} />
