import { DimensionProperty } from "@ourworldindata/utils"
import { Grapher } from "../core/Grapher"
import { GrapherTabOption, GrapherInterface } from "@ourworldindata/types"
import {
    TestMetadata,
    createOwidTestDataset,
    fakeEntities,
} from "../testData/OwidTestData"

export const childMortalityGrapher = (
    props: Partial<GrapherInterface> = {}
): Grapher => {
    const childMortalityId = 104402
    const childMortalityMetadata: TestMetadata = {
        id: childMortalityId,
        display: {
            name: "Child mortality",
            unit: "%",
            shortUnit: "%",
            conversionFactor: 0.1,
        },
    }
    const childMortalityData = [
        { year: 1950, entity: fakeEntities.Afghanistan, value: 224.45 },
        { year: 1950, entity: fakeEntities.Iceland, value: 333.68 },

        { year: 2005, entity: fakeEntities.Afghanistan, value: 295.59 },
        { year: 2005, entity: fakeEntities.Iceland, value: 246.12 },

        { year: 2019, entity: fakeEntities.Afghanistan, value: 215.59 },
        { year: 2019, entity: fakeEntities.Iceland, value: 226.12 },
    ]
    const dimensions = [
        {
            variableId: childMortalityId,
            property: DimensionProperty.y,
        },
    ]
    return new Grapher({
        tab: GrapherTabOption.WorldMap,
        dimensions,
        ...props,
        owidDataset: createOwidTestDataset([
            {
                metadata: childMortalityMetadata,
                data: childMortalityData,
            },
        ]),
    })
}

export const GrapherWithIncompleteData = (
    props: Partial<GrapherInterface> = {}
): Grapher => {
    const indicatorId = 3512
    const metadata = { id: indicatorId, shortUnit: "%" }
    const data = [
        { year: 2000, entity: fakeEntities.Iceland, value: 4 },
        { year: 2001, entity: fakeEntities.France, value: 22 },
        { year: 2010, entity: fakeEntities.Afghanistan, value: 20 },
        { year: 2009, entity: fakeEntities.Iceland, value: 34 },
    ]
    const dimensions = [
        {
            variableId: indicatorId,
            property: DimensionProperty.y,
            display: {
                name: "",
                unit: "% of children under 5",
                tolerance: 1,
                isProjection: false,
            },
        },
        {
            variableId: indicatorId,
            property: DimensionProperty.x,
            targetYear: 2010,
            display: {
                name: "Children in 2010",
                unit: "% of children under 5",
                tolerance: 1,
                isProjection: false,
            },
        },
    ]
    return new Grapher({
        tab: GrapherTabOption.Table,
        dimensions,
        ...props,
        owidDataset: createOwidTestDataset([{ metadata, data }]),
    })
}

export const GrapherWithAggregates = (
    props: Partial<GrapherInterface> = {}
): Grapher => {
    const childMortalityId = 104402
    const childMortalityMetadata: TestMetadata = {
        id: childMortalityId,
        display: {
            name: "Child mortality",
            unit: "%",
            shortUnit: "%",
            conversionFactor: 0.1,
        },
    }
    const childMortalityData = [
        { year: 1950, entity: fakeEntities.Afghanistan, value: 224.45 },
        { year: 1950, entity: fakeEntities.Iceland, value: 333.68 },
        { year: 1950, entity: fakeEntities.World, value: 456.33 },

        { year: 2005, entity: fakeEntities.Afghanistan, value: 295.59 },
        { year: 2005, entity: fakeEntities.Iceland, value: 246.12 },
        { year: 2005, entity: fakeEntities.World, value: 298.87 },

        { year: 2019, entity: fakeEntities.Afghanistan, value: 215.59 },
        { year: 2019, entity: fakeEntities.Iceland, value: 226.12 },
        { year: 2019, entity: fakeEntities.World, value: 450.87 },
    ]
    const dimensions = [
        {
            variableId: childMortalityId,
            property: DimensionProperty.y,
        },
    ]
    return new Grapher({
        tab: GrapherTabOption.Table,
        dimensions,
        ...props,
        owidDataset: createOwidTestDataset([
            { metadata: childMortalityMetadata, data: childMortalityData },
        ]),
    })
}

export const GrapherWithMultipleVariablesAndMultipleYears = (
    props: Partial<GrapherInterface> = {}
): Grapher => {
    const abovePovertyLineId = 514050
    const belowPovertyLineId = 472265

    const dimensions = [
        {
            variableId: abovePovertyLineId,
            property: DimensionProperty.y,
        },
        {
            variableId: belowPovertyLineId,
            property: DimensionProperty.y,
        },
    ]

    const abovePovertyLineDataset = {
        metadata: { id: abovePovertyLineId },
        data: [
            { year: 1950, entity: fakeEntities.World, value: 10 },
            { year: 2005, entity: fakeEntities.World, value: 20 },
            { year: 2019, entity: fakeEntities.World, value: 30 },
        ],
    }
    const belowPovertyLineDataset = {
        metadata: { id: belowPovertyLineId },
        data: [
            { year: 1950, entity: fakeEntities.World, value: 5 },
            { year: 2005, entity: fakeEntities.World, value: 15 },
            { year: 2019, entity: fakeEntities.World, value: 10 },
        ],
    }

    return new Grapher({
        tab: GrapherTabOption.Table,
        dimensions,
        ...props,
        owidDataset: createOwidTestDataset([
            abovePovertyLineDataset,
            belowPovertyLineDataset,
        ]),
    })
}
