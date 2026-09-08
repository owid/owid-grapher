import { MigratableConfig } from "./helpers"

/** Before/after pairs pinning what each migration step rewrites */
export const MIGRATION_FIXTURES: {
    name: string
    before: MigratableConfig
    after: MigratableConfig
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
        name: "renames hideLegend to hideSeriesLabels on a line chart",
        before: {
            $schema:
                "https://files.ourworldindata.org/schemas/grapher-schema.009.json",
            hideLegend: true,
        },
        after: {
            $schema:
                "https://files.ourworldindata.org/schemas/grapher-schema.010.json",
            hideSeriesLabels: true,
        },
    },
    {
        name: "carries a false hideLegend across on a line chart",
        before: {
            $schema:
                "https://files.ourworldindata.org/schemas/grapher-schema.009.json",
            hideLegend: false,
        },
        after: {
            $schema:
                "https://files.ourworldindata.org/schemas/grapher-schema.010.json",
            hideSeriesLabels: false,
        },
    },
    {
        name: "drops hideLegend from a chart type without series labels",
        before: {
            $schema:
                "https://files.ourworldindata.org/schemas/grapher-schema.009.json",
            chartTypes: ["ScatterPlot"],
            hideLegend: true,
        },
        after: {
            $schema:
                "https://files.ourworldindata.org/schemas/grapher-schema.010.json",
            chartTypes: ["ScatterPlot"],
        },
    },
    {
        name: "leaves a config without hideLegend alone",
        before: {
            $schema:
                "https://files.ourworldindata.org/schemas/grapher-schema.009.json",
            title: "Test",
        },
        after: {
            $schema:
                "https://files.ourworldindata.org/schemas/grapher-schema.010.json",
            title: "Test",
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

/**
 * Patch stacks, parent first. Migrating the patches and then merging them has
 * to come out the same as merging them and then migrating the result, unless
 * the stack names a `nonCommutingReason` — those are the steps that can't be
 * expressed one layer at a time, and they're pinned so that repairing one is a
 * deliberate act.
 */
export const PATCH_STACK_FIXTURES: {
    name: string
    patches: MigratableConfig[]
    nonCommutingReason?: string
}[] = [
    {
        name: "a child alongside a parent's selectedData",
        patches: [
            {
                $schema:
                    "https://files.ourworldindata.org/schemas/grapher-schema.001.json",
                selectedData: [{ index: 0, entityId: 1 }],
            },
            {
                $schema:
                    "https://files.ourworldindata.org/schemas/grapher-schema.001.json",
                title: "Child",
            },
        ],
    },
    {
        name: "a child turning an inherited hideTitleAnnotation back off",
        nonCommutingReason:
            "the step ignores a false hideTitleAnnotation, so the child has nothing left to override the parent's expanded annotations with",
        patches: [
            {
                $schema:
                    "https://files.ourworldindata.org/schemas/grapher-schema.002.json",
                hideTitleAnnotation: true,
            },
            {
                $schema:
                    "https://files.ourworldindata.org/schemas/grapher-schema.002.json",
                hideTitleAnnotation: false,
            },
        ],
    },
    {
        name: "a child alongside a parent's data",
        patches: [
            {
                $schema:
                    "https://files.ourworldindata.org/schemas/grapher-schema.003.json",
                data: { availableEntities: [] },
            },
            {
                $schema:
                    "https://files.ourworldindata.org/schemas/grapher-schema.003.json",
                title: "Child",
            },
        ],
    },
    {
        name: "a child alongside a parent's hideLinesOutsideTolerance",
        patches: [
            {
                $schema:
                    "https://files.ourworldindata.org/schemas/grapher-schema.004.json",
                hideLinesOutsideTolerance: true,
            },
            {
                $schema:
                    "https://files.ourworldindata.org/schemas/grapher-schema.004.json",
                title: "Child",
            },
        ],
    },
    {
        name: "a child naming the chart type whose tab its parent hid",
        nonCommutingReason:
            "the step reads type and hasChartTab together, and they sit in different layers",
        patches: [
            {
                $schema:
                    "https://files.ourworldindata.org/schemas/grapher-schema.005.json",
                hasChartTab: false,
            },
            {
                $schema:
                    "https://files.ourworldindata.org/schemas/grapher-schema.005.json",
                type: "ScatterPlot",
            },
        ],
    },
    {
        name: "a child setting a map time under a parent's map projection",
        patches: [
            {
                $schema:
                    "https://files.ourworldindata.org/schemas/grapher-schema.006.json",
                map: { projection: "Europe" },
            },
            {
                $schema:
                    "https://files.ourworldindata.org/schemas/grapher-schema.006.json",
                map: { time: 2000 },
            },
        ],
    },
    {
        name: "a child setting the min value for its parent's custom bins",
        nonCommutingReason:
            "the step folds customNumericMinValue into customNumericValues, and they sit in different layers",
        patches: [
            {
                $schema:
                    "https://files.ourworldindata.org/schemas/grapher-schema.007.json",
                colorScale: { customNumericValues: [20, 30] },
            },
            {
                $schema:
                    "https://files.ourworldindata.org/schemas/grapher-schema.007.json",
                colorScale: { customNumericMinValue: 10 },
            },
        ],
    },
    {
        name: "a child choosing a binning strategy for its parent's bin count",
        patches: [
            {
                $schema:
                    "https://files.ourworldindata.org/schemas/grapher-schema.008.json",
                colorScale: { binningStrategyBinCount: 7 },
            },
            {
                $schema:
                    "https://files.ourworldindata.org/schemas/grapher-schema.008.json",
                colorScale: { binningStrategy: "ckmeans" },
            },
        ],
    },
    {
        name: "a scatter plot child under a parent's hideLegend",
        nonCommutingReason:
            "the step reads chartTypes to decide whether hideLegend becomes hideSeriesLabels, and the parent layer doesn't carry it",
        patches: [
            {
                $schema:
                    "https://files.ourworldindata.org/schemas/grapher-schema.009.json",
                hideLegend: true,
            },
            {
                $schema:
                    "https://files.ourworldindata.org/schemas/grapher-schema.009.json",
                chartTypes: ["ScatterPlot"],
            },
        ],
    },
    {
        name: "a child turning an inherited hideLegend back off",
        patches: [
            {
                $schema:
                    "https://files.ourworldindata.org/schemas/grapher-schema.009.json",
                hideLegend: true,
            },
            {
                $schema:
                    "https://files.ourworldindata.org/schemas/grapher-schema.009.json",
                hideLegend: false,
            },
        ],
    },
    {
        name: "a child replacing dimensions that carry yearIsDay",
        patches: [
            {
                $schema:
                    "https://files.ourworldindata.org/schemas/grapher-schema.010.json",
                dimensions: [
                    {
                        property: "y",
                        variableId: 1,
                        display: { yearIsDay: true },
                    },
                ],
            },
            {
                $schema:
                    "https://files.ourworldindata.org/schemas/grapher-schema.010.json",
                dimensions: [
                    {
                        property: "y",
                        variableId: 1,
                        display: { yearIsDay: false },
                    },
                ],
            },
        ],
    },
]
