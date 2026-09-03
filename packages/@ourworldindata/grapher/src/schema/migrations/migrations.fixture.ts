import { AnyConfigWithValidSchema } from "./helpers"

/** Before/after pairs pinning what each migration step rewrites */
export const MIGRATION_FIXTURES: {
    before: AnyConfigWithValidSchema
    after: AnyConfigWithValidSchema
}[] = [
    {
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
