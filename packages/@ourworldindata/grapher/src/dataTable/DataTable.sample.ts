import { DimensionProperty } from "@ourworldindata/utils"
import { Grapher } from "../core/Grapher"
import { GrapherTabOption } from "../core/GrapherConstants"
import { GrapherInterface } from "../core/GrapherInterface"

export const childMortalityGrapher = (
    props: Partial<GrapherInterface> = {}
): Grapher =>
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
        owidDataset: new Map([
            [
                104402,
                {
                    data: {
                        years: [1950, 1950, 2005, 2005, 2019, 2019],
                        entities: [15, 207, 15, 207, 15, 207],
                        values: [
                            224.45, 333.68, 295.59, 246.12, 215.59, 226.12,
                        ],
                    },
                    metadata: {
                        id: 104402,
                        display: {
                            name: "Child mortality",
                            unit: "%",
                            shortUnit: "%",
                            conversionFactor: 0.1,
                        },
                        dimensions: {
                            entities: {
                                values: [
                                    {
                                        name: "Afghanistan",
                                        id: 15,
                                        code: "AFG",
                                    },
                                    { name: "Iceland", id: 207, code: "ICE" },
                                ],
                            },
                            years: {
                                values: [
                                    {
                                        id: 1950,
                                    },
                                    {
                                        id: 2005,
                                    },
                                    {
                                        id: 2019,
                                    },
                                ],
                            },
                        },
                    },
                },
            ],
        ]),
    })

export const IncompleteDataTable = (
    props: Partial<GrapherInterface> = {}
): Grapher =>
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
            {
                variableId: 3512,
                property: DimensionProperty.x,
                targetYear: 2010,
                display: {
                    name: "Children in 2010",
                    unit: "% of children under 5",
                    tolerance: 1,
                    isProjection: false,
                },
            },
        ],
        ...props,
        owidDataset: new Map([
            [
                3512,
                {
                    data: {
                        years: [2000, 2001, 2010, 2009],
                        entities: [207, 33, 15, 207],
                        values: [4, 22, 20, 34],
                    },
                    metadata: {
                        id: 3512,
                        shortUnit: "%",
                        dimensions: {
                            entities: {
                                values: [
                                    {
                                        name: "Afghanistan",
                                        id: 15,
                                        code: "AFG",
                                    },
                                    { name: "Iceland", id: 207, code: "ISL" },
                                    { name: "France", id: 33, code: "FRA" },
                                ],
                            },
                            years: {
                                values: [
                                    {
                                        id: 2000,
                                    },
                                    {
                                        id: 2001,
                                    },
                                    {
                                        id: 2010,
                                    },
                                    {
                                        id: 2009,
                                    },
                                ],
                            },
                        },
                    },
                },
            ],
        ]),
    })
