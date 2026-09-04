import { AnyConfigWithValidSchema } from "./helpers"

/** Before/after pairs pinning what each migration step rewrites */
export const MIGRATION_FIXTURES: {
    name: string
    before: AnyConfigWithValidSchema
    after: AnyConfigWithValidSchema
}[] = [
    {
        name: "drops selectedData",
        before: {
            $schema:
                "https://files.ourworldindata.org/schemas/grapher-schema.001.json",
            selectedData: [{ index: 0, entityId: 1 }],
            title: "Test",
        },
        after: {
            $schema:
                "https://files.ourworldindata.org/schemas/grapher-schema.002.json",
            title: "Test",
        },
    },
    {
        name: "expands hideTitleAnnotation into hideTitleAnnotations",
        before: {
            $schema:
                "https://files.ourworldindata.org/schemas/grapher-schema.002.json",
            hideTitleAnnotation: true,
        },
        after: {
            $schema:
                "https://files.ourworldindata.org/schemas/grapher-schema.003.json",
            hideTitleAnnotations: { entity: true, time: true, change: true },
        },
    },
    {
        name: "drops a false hideTitleAnnotation",
        before: {
            $schema:
                "https://files.ourworldindata.org/schemas/grapher-schema.002.json",
            hideTitleAnnotation: false,
        },
        after: {
            $schema:
                "https://files.ourworldindata.org/schemas/grapher-schema.003.json",
        },
    },
    {
        name: "drops data",
        before: {
            $schema:
                "https://files.ourworldindata.org/schemas/grapher-schema.003.json",
            data: { availableEntities: [] },
        },
        after: {
            $schema:
                "https://files.ourworldindata.org/schemas/grapher-schema.004.json",
        },
    },
    {
        name: "drops hideLinesOutsideTolerance",
        before: {
            $schema:
                "https://files.ourworldindata.org/schemas/grapher-schema.004.json",
            hideLinesOutsideTolerance: true,
        },
        after: {
            $schema:
                "https://files.ourworldindata.org/schemas/grapher-schema.005.json",
        },
    },
    {
        name: "turns a non-line type into chartTypes",
        before: {
            $schema:
                "https://files.ourworldindata.org/schemas/grapher-schema.005.json",
            type: "ScatterPlot",
            hasChartTab: true,
        },
        after: {
            $schema:
                "https://files.ourworldindata.org/schemas/grapher-schema.006.json",
            chartTypes: ["ScatterPlot"],
        },
    },
    {
        name: "turns a hidden chart tab into empty chartTypes",
        before: {
            $schema:
                "https://files.ourworldindata.org/schemas/grapher-schema.005.json",
            type: "ScatterPlot",
            hasChartTab: false,
        },
        after: {
            $schema:
                "https://files.ourworldindata.org/schemas/grapher-schema.006.json",
            chartTypes: [],
        },
    },
    {
        name: "leaves the default line chart without chartTypes",
        before: {
            $schema:
                "https://files.ourworldindata.org/schemas/grapher-schema.005.json",
            type: "LineChart",
        },
        after: {
            $schema:
                "https://files.ourworldindata.org/schemas/grapher-schema.006.json",
        },
    },
    {
        name: "renames map.projection to map.region",
        before: {
            $schema:
                "https://files.ourworldindata.org/schemas/grapher-schema.006.json",
            hasMapTab: true,
            map: {
                projection: "Europe",
                time: 2000,
            },
        },
        after: {
            $schema:
                "https://files.ourworldindata.org/schemas/grapher-schema.007.json",
            hasMapTab: true,
            map: {
                region: "Europe",
                time: 2000,
            },
        },
    },
    {
        name: "folds map.colorScale.customNumericMinValue into customNumericValues",
        before: {
            $schema:
                "https://files.ourworldindata.org/schemas/grapher-schema.007.json",
            hasMapTab: true,
            map: {
                colorScale: {
                    customNumericMinValue: 0,
                    customNumericValues: [1, 2, 3],
                },
            },
        },
        after: {
            $schema:
                "https://files.ourworldindata.org/schemas/grapher-schema.008.json",
            hasMapTab: true,
            map: {
                colorScale: {
                    customNumericValues: [0, 1, 2, 3],
                },
            },
        },
    },
    {
        name: "folds colorScale.customNumericMinValue into customNumericValues",
        before: {
            $schema:
                "https://files.ourworldindata.org/schemas/grapher-schema.007.json",
            colorScale: {
                customNumericMinValue: 10,
                customNumericValues: [20, 30],
            },
        },
        after: {
            $schema:
                "https://files.ourworldindata.org/schemas/grapher-schema.008.json",
            colorScale: {
                customNumericValues: [10, 20, 30],
            },
        },
    },
    {
        name: "resets non-manual binningStrategy to auto and drops the bin count",
        before: {
            $schema:
                "https://files.ourworldindata.org/schemas/grapher-schema.008.json",
            map: {
                colorScale: {
                    binningStrategy: "ckmeans",
                    binningStrategyBinCount: 5,
                },
            },
            colorScale: {
                binningStrategy: "manual",
                binningStrategyBinCount: 3,
            },
        },
        after: {
            $schema:
                "https://files.ourworldindata.org/schemas/grapher-schema.009.json",
            map: {
                colorScale: {
                    binningStrategy: "auto",
                },
            },
            colorScale: {
                binningStrategy: "manual",
            },
        },
    },
    {
        name: "replaces yearIsDay with timeInterval",
        before: {
            $schema:
                "https://files.ourworldindata.org/schemas/grapher-schema.010.json",
            dimensions: [
                {
                    property: "y",
                    variableId: 1,
                    display: { yearIsDay: true },
                },
                {
                    property: "y",
                    variableId: 2,
                    display: { yearIsDay: false },
                },
                { property: "y", variableId: 3, display: { unit: "%" } },
            ],
        },
        after: {
            $schema:
                "https://files.ourworldindata.org/schemas/grapher-schema.011.json",
            dimensions: [
                {
                    property: "y",
                    variableId: 1,
                    display: { timeInterval: "day" },
                },
                { property: "y", variableId: 2, display: {} },
                { property: "y", variableId: 3, display: { unit: "%" } },
            ],
        },
    },
]
