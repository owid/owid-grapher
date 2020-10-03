import { GrapherProgrammaticInterface } from "grapher/core/Grapher"
import {
    GrapherTabOption,
    DimensionProperty,
} from "grapher/core/GrapherConstants"

export const legacyMapGrapher: GrapherProgrammaticInterface = {
    hasMapTab: true,
    tab: GrapherTabOption.map,
    map: {
        timeTolerance: 5,
    },
    dimensions: [
        {
            variableId: 3512,
            property: DimensionProperty.y,
            display: {
                name: "",
                unit: "% of children under 5",
                tolerance: 5,
                isProjection: false,
            },
        },
    ],
    owidDataset: {
        variables: {
            "3512": {
                years: [2000, 2010, 2010],
                entities: [207, 15, 207],
                values: [4, 20, 34],
                id: 3512,
                shortUnit: "%",
            },
        },
        entityKey: {
            "15": { name: "Afghanistan", id: 15, code: "AFG" },
            "207": { name: "Iceland", id: 207, code: "ISL" },
        },
    },
    queryStr: "?time=2002",
}
