import { DimensionProperty } from "@ourworldindata/utils"
import { Grapher, GrapherProgrammaticInterface } from "../core/Grapher"
import {
    TestMetadata,
    createOwidTestDataset,
    fakeEntities,
} from "../testData/OwidTestData"

/**
Grapher properties:
- Single y-dimension
- Multiple entities, including World, Continents, and Countries
 */
export const LifeExpectancyGrapher = (
    props: Partial<GrapherProgrammaticInterface> = {}
): Grapher => {
    const lifeExpectancyId = 815383
    const lifeExpectancyMetadata: TestMetadata = {
        id: lifeExpectancyId,
        display: {
            name: "Life expectancy at birth",
            unit: "years",
            shortUnit: "years",
            numDecimalPlaces: 1,
        },
    }
    const lifeExpectancyData = [
        { year: 1950, entity: fakeEntities.World, value: 46.5 },
        { year: 1950, entity: fakeEntities.France, value: 66.4 },
        { year: 1950, entity: fakeEntities.Europe, value: 62.8 },
        { year: 1950, entity: fakeEntities.China, value: 43.7 },
        { year: 1950, entity: fakeEntities.Asia, value: 42.0 },
        { year: 1950, entity: fakeEntities.India, value: 41.7 },
        { year: 1950, entity: fakeEntities.Africa, value: 37.6 },

        { year: 2005, entity: fakeEntities.World, value: 74.1 },
        { year: 2005, entity: fakeEntities.France, value: 80.3 },
        { year: 2005, entity: fakeEntities.Europe, value: 74.5 },
        { year: 2005, entity: fakeEntities.China, value: 69.6 },
        { year: 2005, entity: fakeEntities.Asia, value: 68.2 },
        { year: 2005, entity: fakeEntities.India, value: 65.0 },
        { year: 2005, entity: fakeEntities.Africa, value: 55.5 },

        { year: 2020, entity: fakeEntities.World, value: 77.7 },
        { year: 2020, entity: fakeEntities.France, value: 82.2 },
        { year: 2020, entity: fakeEntities.Europe, value: 78.1 },
        { year: 2020, entity: fakeEntities.China, value: 73.7 },
        { year: 2020, entity: fakeEntities.Asia, value: 72.0 },
        { year: 2020, entity: fakeEntities.India, value: 70.1 },
        { year: 2020, entity: fakeEntities.Africa, value: 62.2 },
    ]
    const dimensions = [
        {
            variableId: lifeExpectancyId,
            property: DimensionProperty.y,
        },
    ]
    return new Grapher({
        ...props,
        dimensions,
        owidDataset: createOwidTestDataset([
            {
                metadata: lifeExpectancyMetadata,
                data: lifeExpectancyData,
            },
        ]),
    })
}
