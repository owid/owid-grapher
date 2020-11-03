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

export const IncompleteDataTable = (props: Partial<GrapherInterface> = {}) =>
    new Grapher({
        tab: GrapherTabOption.table,
        dimensions: [
            {
                variableId: 3512,
                property: DimensionProperty.y,
                display: {
                    name: "",
                    unit: "% of children under 5",
                    tolerance: 1,
                    isProjection: false,
                },
            },
        ],
        ...props,
        owidDataset: {
            variables: {
                "3512": {
                    years: [2000, 2001, 2010, 2010],
                    entities: [207, 33, 15, 207],
                    values: [4, 22, 20, 34],
                    id: 3512,
                    shortUnit: "%",
                },
            },
            entityKey: {
                "15": { name: "Afghanistan", id: 15, code: "AFG" },
                "207": { name: "Iceland", id: 207, code: "ISL" },
                "33": { name: "France", id: 33, code: "FRA" },
            },
        },
    })
