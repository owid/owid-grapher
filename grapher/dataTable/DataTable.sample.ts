import { Grapher } from "grapher/core/Grapher"
import {
    DimensionProperty,
    GrapherTabOption,
} from "grapher/core/GrapherConstants"
import { GrapherInterface } from "grapher/core/GrapherInterface"

export const childMortalityGrapher = (props: Partial<GrapherInterface> = {}) =>
    new Grapher({
        hasMapTab: true,
        tab: GrapherTabOption.map,
        dimensions: [
            {
                variableId: 104402,
                property: DimensionProperty.y,
            },
        ],
        ...props,
        owidDataset: {
            variables: {
                "104402": {
                    years: [1950, 1950, 2005, 2005, 2019, 2019],
                    entities: [15, 207, 15, 207, 15, 207],
                    values: [224.45, 333.68, 295.59, 246.12, 215.59, 226.12],
                    id: 104402,
                    display: {
                        name: "Child mortality",
                        unit: "%",
                        shortUnit: "%",
                        conversionFactor: 0.1,
                    },
                },
            },
            entityKey: {
                "15": { name: "Afghanistan", id: 15, code: "AFG" },
                "207": { name: "Iceland", id: 207, code: "ICE" },
            },
        },
    })
