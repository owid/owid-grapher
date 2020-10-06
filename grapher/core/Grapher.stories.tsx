import * as React from "react"
import { Grapher, GrapherProgrammaticInterface } from "./Grapher"
import { SampleColumnSlugs, SynthesizeGDPTable } from "coreTable/OwidTable"
import {
    ChartTypeName,
    DimensionProperty,
    FacetStrategy,
} from "./GrapherConstants"

export default {
    title: "Grapher",
    component: Grapher,
}

const basics: GrapherProgrammaticInterface = {
    table: SynthesizeGDPTable({ entityCount: 10 }).selectSample(5),
    hasMapTab: true,
    dimensions: [
        {
            slug: SampleColumnSlugs.GDP,
            property: DimensionProperty.y,
            variableId: SampleColumnSlugs.GDP as any,
        },
        {
            slug: SampleColumnSlugs.Population,
            property: DimensionProperty.x,
            variableId: SampleColumnSlugs.Population as any,
        },
    ],
}

export const Line = () => <Grapher {...basics} />

export const NoMap = () => {
    const model = {
        ...basics,
        hasMapTab: false,
    }
    return <Grapher {...model} />
}

export const SlopeChart = () => {
    const model = {
        type: ChartTypeName.SlopeChart,
        ...basics,
    }
    return <Grapher {...model} />
}

export const ScatterPlot = () => {
    const model = {
        type: ChartTypeName.ScatterPlot,
        ...basics,
    }
    return <Grapher {...model} />
}

export const DiscreteBar = () => {
    const model = {
        type: ChartTypeName.DiscreteBar,
        ...basics,
    }
    return <Grapher {...model} />
}

export const StackedBar = () => {
    const model = {
        type: ChartTypeName.StackedBar,
        ...basics,
    }
    return <Grapher {...model} />
}

export const StackedArea = () => {
    const model = {
        type: ChartTypeName.StackedArea,
        ...basics,
    }
    return <Grapher {...model} />
}

export const Faceting = () => {
    const model = {
        type: ChartTypeName.StackedArea,
        facet: FacetStrategy.country,
        ...basics,
    }
    return <Grapher {...model} />
}

export const WithKeyboardShortcuts = () => {
    const model = {
        ...basics,
        enableKeyboardShortcuts: true,
    }
    return <Grapher {...model} />
}
