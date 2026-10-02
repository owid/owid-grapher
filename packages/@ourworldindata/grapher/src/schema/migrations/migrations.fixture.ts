import { MigratableConfig, createSchemaForVersion } from "./helpers"

/** Before/after pairs pinning what each migration step rewrites */
export const MIGRATION_FIXTURES: {
    name: string
    before: MigratableConfig
    after: MigratableConfig
}[] = [
    {
        name: "drops selectedData",
        before: {
            $schema: createSchemaForVersion("001"),
            selectedData: [{ index: 0, entityId: 1 }],
            title: "Test",
        },
        after: {
            $schema: createSchemaForVersion("002"),
            title: "Test",
        },
    },
    {
        name: "expands hideTitleAnnotation into hideAnnotationFieldsInTitle",
        before: {
            $schema: createSchemaForVersion("002"),
            hideTitleAnnotation: true,
        },
        after: {
            $schema: createSchemaForVersion("003"),
            hideAnnotationFieldsInTitle: {
                entity: true,
                time: true,
                changeInPrefix: true,
            },
        },
    },
    {
        name: "expands a false hideTitleAnnotation",
        before: {
            $schema: createSchemaForVersion("002"),
            hideTitleAnnotation: false,
        },
        after: {
            $schema: createSchemaForVersion("003"),
            hideAnnotationFieldsInTitle: {
                entity: false,
                time: false,
                changeInPrefix: false,
            },
        },
    },
    {
        name: "drops data",
        before: {
            $schema: createSchemaForVersion("003"),
            data: { availableEntities: [] },
        },
        after: {
            $schema: createSchemaForVersion("004"),
        },
    },
    {
        name: "drops hideLinesOutsideTolerance",
        before: {
            $schema: createSchemaForVersion("004"),
            hideLinesOutsideTolerance: true,
        },
        after: {
            $schema: createSchemaForVersion("005"),
        },
    },
    {
        name: "turns a non-line type into chartTypes",
        before: {
            $schema: createSchemaForVersion("005"),
            type: "ScatterPlot",
            hasChartTab: true,
        },
        after: {
            $schema: createSchemaForVersion("006"),
            chartTypes: ["ScatterPlot"],
        },
    },
    {
        name: "turns a hidden chart tab into empty chartTypes",
        before: {
            $schema: createSchemaForVersion("005"),
            type: "ScatterPlot",
            hasChartTab: false,
        },
        after: {
            $schema: createSchemaForVersion("006"),
            chartTypes: [],
        },
    },
    {
        name: "turns an explicit line type into chartTypes",
        before: {
            $schema: createSchemaForVersion("005"),
            type: "LineChart",
        },
        after: {
            $schema: createSchemaForVersion("006"),
            chartTypes: ["LineChart"],
        },
    },
    {
        name: "leaves a config without a type alone",
        before: {
            $schema: createSchemaForVersion("005"),
            hasChartTab: true,
        },
        after: {
            $schema: createSchemaForVersion("006"),
        },
    },
    {
        name: "renames map.projection to map.region",
        before: {
            $schema: createSchemaForVersion("006"),
            hasMapTab: true,
            map: {
                projection: "Europe",
                time: 2000,
            },
        },
        after: {
            $schema: createSchemaForVersion("007"),
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
            $schema: createSchemaForVersion("007"),
            hasMapTab: true,
            map: {
                colorScale: {
                    customNumericMinValue: 0,
                    customNumericValues: [1, 2, 3],
                },
            },
        },
        after: {
            $schema: createSchemaForVersion("008"),
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
            $schema: createSchemaForVersion("007"),
            colorScale: {
                customNumericMinValue: 10,
                customNumericValues: [20, 30],
            },
        },
        after: {
            $schema: createSchemaForVersion("008"),
            colorScale: {
                customNumericValues: [10, 20, 30],
            },
        },
    },
    {
        name: "resets non-manual binningStrategy to auto and drops the bin count",
        before: {
            $schema: createSchemaForVersion("008"),
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
            $schema: createSchemaForVersion("009"),
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
            $schema: createSchemaForVersion("009"),
            hideLegend: true,
        },
        after: {
            $schema: createSchemaForVersion("010"),
            hideSeriesLabels: true,
        },
    },
    {
        name: "carries a false hideLegend across on a line chart",
        before: {
            $schema: createSchemaForVersion("009"),
            hideLegend: false,
        },
        after: {
            $schema: createSchemaForVersion("010"),
            hideSeriesLabels: false,
        },
    },
    {
        name: "renames hideLegend even on a chart type without series labels",
        before: {
            $schema: createSchemaForVersion("009"),
            chartTypes: ["ScatterPlot"],
            hideLegend: true,
        },
        after: {
            $schema: createSchemaForVersion("010"),
            chartTypes: ["ScatterPlot"],
            hideSeriesLabels: true,
        },
    },
    {
        name: "leaves a config without hideLegend alone",
        before: {
            $schema: createSchemaForVersion("009"),
            title: "Test",
        },
        after: {
            $schema: createSchemaForVersion("010"),
            title: "Test",
        },
    },
    {
        name: "replaces yearIsDay with timeInterval",
        before: {
            $schema: createSchemaForVersion("010"),
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
            $schema: createSchemaForVersion("011"),
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
                $schema: createSchemaForVersion("001"),
                selectedData: [{ index: 0, entityId: 1 }],
            },
            {
                $schema: createSchemaForVersion("001"),
                title: "Child",
            },
        ],
    },
    {
        name: "a child turning an inherited hideTitleAnnotation back off",
        patches: [
            {
                $schema: createSchemaForVersion("002"),
                hideTitleAnnotation: true,
            },
            {
                $schema: createSchemaForVersion("002"),
                hideTitleAnnotation: false,
            },
        ],
    },
    {
        name: "a child alongside a parent's data",
        patches: [
            {
                $schema: createSchemaForVersion("003"),
                data: { availableEntities: [] },
            },
            {
                $schema: createSchemaForVersion("003"),
                title: "Child",
            },
        ],
    },
    {
        name: "a child alongside a parent's hideLinesOutsideTolerance",
        patches: [
            {
                $schema: createSchemaForVersion("004"),
                hideLinesOutsideTolerance: true,
            },
            {
                $schema: createSchemaForVersion("004"),
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
                $schema: createSchemaForVersion("005"),
                hasChartTab: false,
            },
            {
                $schema: createSchemaForVersion("005"),
                type: "ScatterPlot",
            },
        ],
    },
    {
        name: "a child overriding its parent's chart type",
        patches: [
            {
                $schema: createSchemaForVersion("005"),
                type: "ScatterPlot",
            },
            {
                $schema: createSchemaForVersion("005"),
                type: "LineChart",
            },
        ],
    },
    {
        name: "a child setting a map time under a parent's map projection",
        patches: [
            {
                $schema: createSchemaForVersion("006"),
                map: { projection: "Europe" },
            },
            {
                $schema: createSchemaForVersion("006"),
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
                $schema: createSchemaForVersion("007"),
                colorScale: { customNumericValues: [20, 30] },
            },
            {
                $schema: createSchemaForVersion("007"),
                colorScale: { customNumericMinValue: 10 },
            },
        ],
    },
    {
        name: "a child choosing a binning strategy for its parent's bin count",
        patches: [
            {
                $schema: createSchemaForVersion("008"),
                colorScale: { binningStrategyBinCount: 7 },
            },
            {
                $schema: createSchemaForVersion("008"),
                colorScale: { binningStrategy: "ckmeans" },
            },
        ],
    },
    {
        name: "a scatter plot child under a parent's hideLegend",
        patches: [
            {
                $schema: createSchemaForVersion("009"),
                hideLegend: true,
            },
            {
                $schema: createSchemaForVersion("009"),
                chartTypes: ["ScatterPlot"],
            },
        ],
    },
    {
        name: "a child turning an inherited hideLegend back off",
        patches: [
            {
                $schema: createSchemaForVersion("009"),
                hideLegend: true,
            },
            {
                $schema: createSchemaForVersion("009"),
                hideLegend: false,
            },
        ],
    },
    {
        name: "a child replacing dimensions that carry yearIsDay",
        patches: [
            {
                $schema: createSchemaForVersion("010"),
                dimensions: [
                    {
                        property: "y",
                        variableId: 1,
                        display: { yearIsDay: true },
                    },
                ],
            },
            {
                $schema: createSchemaForVersion("010"),
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
