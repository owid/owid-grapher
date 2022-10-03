import { DimensionProperty } from "../../clientUtils/owidTypes.js"
import { GrapherProgrammaticInterface } from "../core/Grapher.js"
import { GrapherTabOption } from "../core/GrapherConstants.js"

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
    owidDataset: new Map([
        [
            3512,
            {
                data: {
                    years: [2000, 2010, 2010],
                    entities: [207, 15, 207],
                    values: [4, 20, 34],
                },
                metadata: {
                    id: 3512,
                    display: { shortUnit: "%" },
                    dimensions: {
                        entities: {
                            values: [
                                { name: "Afghanistan", id: 15, code: "AFG" },
                                { name: "Iceland", id: 207, code: "ISL" },
                            ],
                        },
                        years: {
                            values: [
                                {
                                    id: 2000,
                                },
                                {
                                    id: 2010,
                                },
                            ],
                        },
                    },
                },
            },
        ],
    ]),
    queryStr: "?time=2002",
}
