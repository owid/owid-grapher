import { describe, it, expect } from "vitest"
import {
    GrapherState,
    GrapherProgrammaticInterface,
} from "@ourworldindata/grapher"
import {
    FacetStrategy,
    DimensionProperty,
    EntitySelectionMode,
    GRAPHER_CHART_TYPES,
    ColorSchemeName,
    BinningStrategy,
} from "@ourworldindata/types"
import {
    SynthesizeGDPTable,
    SampleColumnSlugs,
    SynthesizeFruitTable,
} from "@ourworldindata/core-table"
import { buildChartHitDataTableContent } from "./SearchChartHitDataTableHelpers"
import { SearchChartHitDataTableProps } from "./SearchChartHitDataTable"

function createSingleIndicatorGrapherState(
    overrides: GrapherProgrammaticInterface = {}
) {
    const table = SynthesizeGDPTable(
        { entityCount: 5, timeRange: [2000, 2010] },
        12 // seed
    )

    return new GrapherState({
        table,
        selectedEntityNames: table.sampleEntityName(3),
        dimensions: [
            {
                slug: SampleColumnSlugs.GDP,
                property: DimensionProperty.y,
                variableId: SampleColumnSlugs.GDP as any,
            },
        ],
        ...overrides,
    })
}

function createMultipleIndicatorsGrapherState(
    overrides: GrapherProgrammaticInterface = {}
) {
    const table = SynthesizeGDPTable(
        { entityCount: 5, timeRange: [2000, 2010] },
        12 // seed
    )

    return new GrapherState({
        table,
        selectedEntityNames: table.sampleEntityName(3),
        dimensions: [
            {
                slug: SampleColumnSlugs.GDP,
                property: DimensionProperty.y,
                variableId: SampleColumnSlugs.GDP as any,
            },
            {
                slug: SampleColumnSlugs.Population,
                property: DimensionProperty.y,
                variableId: SampleColumnSlugs.Population as any,
            },
            {
                slug: SampleColumnSlugs.LifeExpectancy,
                property: DimensionProperty.y,
                variableId: SampleColumnSlugs.LifeExpectancy as any,
            },
        ],
        ...overrides,
    })
}

function createFruityMultipleIndicatorsGrapherState(
    overrides: GrapherProgrammaticInterface = {}
) {
    const table = SynthesizeFruitTable(
        { entityCount: 5, timeRange: [2000, 2010] },
        12 // seed
    )

    return new GrapherState({
        table,
        selectedEntityNames: table.sampleEntityName(1),
        dimensions: [
            {
                slug: SampleColumnSlugs.Fruit,
                property: DimensionProperty.y,
                variableId: SampleColumnSlugs.Fruit as any,
            },
            {
                slug: SampleColumnSlugs.Vegetables,
                property: DimensionProperty.y,
                variableId: SampleColumnSlugs.Vegetables as any,
            },
        ],
        addCountryMode: EntitySelectionMode.SingleEntity,
        ...overrides,
    })
}

describe("buildChartHitDataTableContent for LineChart", () => {
    it("lists entities when entities are plotted", () => {
        const grapherState = createSingleIndicatorGrapherState()

        const result = buildChartHitDataTableContent({ grapherState })

        expect(result?.type).toBe("data-table")
        const dataTable = result?.props as SearchChartHitDataTableProps

        expect(dataTable.title).toBe("GDP")
        expect(dataTable.rows).toMatchObject([
            { label: "Philippines", time: "2009", value: "$682.03 billion" },
            { label: "Benin", time: "2009", value: "$233.42 billion" },
            { label: "Eritrea", time: "2009", value: "$63.2 billion" },
        ])

        // Check that the colors are unique
        const colors = dataTable.rows.map((row) => row.color)
        expect(new Set(colors)).toHaveLength(colors!.length)
    })

    it("lists columns when columns are plotted", () => {
        const grapherState = createFruityMultipleIndicatorsGrapherState()

        const result = buildChartHitDataTableContent({ grapherState })

        expect(result?.type).toBe("data-table")
        const dataTable = result?.props as SearchChartHitDataTableProps

        expect(dataTable.title).toBe("Benin")
        expect(dataTable.rows).toMatchObject([
            { label: "Fruit", time: "2009", value: "573" },
            { label: "Vegetables", time: "2009", value: "542" },
        ])

        // Check that the colors are unique
        const colors = dataTable.rows.map((row) => row.color)
        expect(new Set(colors)).toHaveLength(colors!.length)
    })

    it("highlights focused entities", () => {
        const selectedEntityNames = ["Philippines", "Benin", "Eritrea"]
        const grapherState = createSingleIndicatorGrapherState({
            selectedEntityNames,
            focusedSeriesNames: [selectedEntityNames[1]],
        })

        const result = buildChartHitDataTableContent({ grapherState })

        expect(result?.type).toBe("data-table")
        const dataTable = result?.props as SearchChartHitDataTableProps

        expect(dataTable.rows).toMatchObject([
            { label: "Philippines", muted: true },
            { label: "Benin", muted: false },
            { label: "Eritrea", muted: true },
        ])
    })

    it("lists all entities in facets when each facet plots a single entity", () => {
        const grapherState = createSingleIndicatorGrapherState({
            selectedFacetStrategy: FacetStrategy.entity,
        })

        const result = buildChartHitDataTableContent({ grapherState })

        expect(result?.type).toBe("data-table")
        const dataTable = result?.props as SearchChartHitDataTableProps

        expect(dataTable.title).toBe("GDP")
        expect(dataTable.rows).toMatchObject([
            { label: "Philippines", time: "2009", value: "$682.03 billion" },
            { label: "Benin", time: "2009", value: "$233.42 billion" },
            { label: "Eritrea", time: "2009", value: "$63.2 billion" },
        ])
    })

    it("lists entities of the first facet when each facet plots multiple entities", () => {
        const grapherState = createMultipleIndicatorsGrapherState({
            selectedFacetStrategy: FacetStrategy.metric,
        })

        const result = buildChartHitDataTableContent({ grapherState })

        expect(result?.type).toBe("data-table")
        const dataTable = result?.props as SearchChartHitDataTableProps

        expect(dataTable.title).toBe("GDP")
        expect(dataTable.rows).toMatchObject([
            { label: "Philippines", time: "2009", value: "$682.03 billion" },
            { label: "Benin", time: "2009", value: "$233.42 billion" },
            { label: "Eritrea", time: "2009", value: "$63.2 billion" },
        ])

        // Check that the colors are unique
        const colors = dataTable.rows.map((row) => row.color)
        expect(new Set(colors)).toHaveLength(colors!.length)
    })
})

describe("buildChartHitDataTableContent for SlopeChart", () => {
    it("lists entities when entities are plotted", () => {
        const grapherState = createSingleIndicatorGrapherState({
            chartTypes: [GRAPHER_CHART_TYPES.SlopeChart],
        })

        const result = buildChartHitDataTableContent({ grapherState })

        expect(result?.type).toBe("data-table")
        const dataTable = result?.props as SearchChartHitDataTableProps

        expect(dataTable.title).toBe("GDP")
        expect(dataTable.rows).toMatchObject([
            {
                label: "Philippines",
                time: "2000–2009",
                startValue: "$663.99 billion",
                value: "$682.03 billion",
                trend: "up",
            },
            {
                label: "Benin",
                time: "2000–2009",
                startValue: "$252.54 billion",
                value: "$233.42 billion",
                trend: "down",
            },
            {
                label: "Eritrea",
                time: "2000–2009",
                value: "$63.2 billion",
                startValue: "$69.27 billion",
                trend: "down",
            },
        ])

        // Check that the colors are unique
        const colors = dataTable.rows.map((row) => row.color)
        expect(new Set(colors)).toHaveLength(colors!.length)
    })

    it("lists columns when columns are plotted", () => {
        const grapherState = createFruityMultipleIndicatorsGrapherState({
            chartTypes: [GRAPHER_CHART_TYPES.SlopeChart],
        })

        const result = buildChartHitDataTableContent({ grapherState })

        expect(result?.type).toBe("data-table")
        const dataTable = result?.props as SearchChartHitDataTableProps

        expect(dataTable.title).toBe("Benin")
        expect(dataTable.rows).toMatchObject([
            {
                label: "Fruit",
                time: "2000–2009",
                startValue: "603",
                value: "573",
                trend: "down",
            },
            {
                label: "Vegetables",
                time: "2000–2009",
                value: "542",
                startValue: "534",
                trend: "up",
            },
        ])

        // Check that the colors are unique
        const colors = dataTable.rows.map((row) => row.color)
        expect(new Set(colors)).toHaveLength(colors!.length)
    })

    it("highlights focused entities", () => {
        const table = SynthesizeGDPTable(
            { entityCount: 5, timeRange: [2000, 2010] },
            12 // seed
        )
        const selectedEntityNames = table.sampleEntityName(3)
        const grapherState = createSingleIndicatorGrapherState({
            chartTypes: [GRAPHER_CHART_TYPES.SlopeChart],
            focusedSeriesNames: [selectedEntityNames[0]],
        })

        const result = buildChartHitDataTableContent({ grapherState })

        expect(result?.type).toBe("data-table")
        const dataTable = result?.props as SearchChartHitDataTableProps

        expect(dataTable.title).toBe("GDP")
        expect(dataTable.rows).toMatchObject([
            { label: "Philippines", muted: true },
            { label: "Benin", muted: false },
            { label: "Eritrea", muted: true },
        ])
    })

    it("lists all entities in facets when each facet plots a single entity", () => {
        const grapherState = createSingleIndicatorGrapherState({
            chartTypes: [GRAPHER_CHART_TYPES.SlopeChart],
            selectedFacetStrategy: FacetStrategy.entity,
        })

        const result = buildChartHitDataTableContent({ grapherState })

        expect(result?.type).toBe("data-table")
        const dataTable = result?.props as SearchChartHitDataTableProps

        expect(dataTable.title).toBe("GDP")
        expect(dataTable.rows).toMatchObject([
            {
                label: "Philippines",
                startValue: "$663.99 billion",
                value: "$682.03 billion",
                time: "2000–2009",
                trend: "up",
            },
            {
                label: "Benin",
                startValue: "$252.54 billion",
                value: "$233.42 billion",
                time: "2000–2009",
                trend: "down",
            },
            {
                label: "Eritrea",
                startValue: "$69.27 billion",
                value: "$63.2 billion",
                time: "2000–2009",
                trend: "down",
            },
        ])
    })

    it("lists entities of the first facet when each facet plots multiple entities", () => {
        const grapherState = createMultipleIndicatorsGrapherState({
            chartTypes: [GRAPHER_CHART_TYPES.SlopeChart],
            selectedFacetStrategy: FacetStrategy.metric,
        })

        const result = buildChartHitDataTableContent({ grapherState })

        expect(result?.type).toBe("data-table")
        const dataTable = result?.props as SearchChartHitDataTableProps

        expect(dataTable.title).toBe("GDP")
        expect(dataTable.rows).toMatchObject([
            {
                label: "Philippines",
                startValue: "$663.99 billion",
                value: "$682.03 billion",
                time: "2000–2009",
                trend: "up",
            },
            {
                label: "Benin",
                startValue: "$252.54 billion",
                value: "$233.42 billion",
                time: "2000–2009",
                trend: "down",
            },
            {
                label: "Eritrea",
                startValue: "$69.27 billion",
                value: "$63.2 billion",
                time: "2000–2009",
                trend: "down",
            },
        ])

        // Check that the colors are unique
        const colors = dataTable.rows.map((row) => row.color)
        expect(new Set(colors)).toHaveLength(colors!.length)
    })
})

describe("buildChartHitDataTableContent for StackedAreaChart", () => {
    it("lists entities when entities are plotted", () => {
        const grapherState = createSingleIndicatorGrapherState({
            chartTypes: [GRAPHER_CHART_TYPES.StackedArea],
        })

        const result = buildChartHitDataTableContent({ grapherState })

        expect(result?.type).toBe("data-table")
        const dataTable = result?.props as SearchChartHitDataTableProps

        expect(dataTable.title).toBe("GDP")
        expect(dataTable.rows).toMatchObject([
            { label: "Benin", time: "2009", value: "$233.42 billion" },
            { label: "Philippines", time: "2009", value: "$682.03 billion" },
            { label: "Eritrea", time: "2009", value: "$63.2 billion" },
        ])

        // Check that the colors are unique
        const colors = dataTable.rows.map((row) => row.color)
        expect(new Set(colors)).toHaveLength(colors!.length)
    })

    it("lists columns when columns are plotted", () => {
        const grapherState = createFruityMultipleIndicatorsGrapherState({
            chartTypes: [GRAPHER_CHART_TYPES.StackedArea],
        })

        const result = buildChartHitDataTableContent({ grapherState })

        expect(result?.type).toBe("data-table")
        const dataTable = result?.props as SearchChartHitDataTableProps

        expect(dataTable.title).toBe("Benin")
        expect(dataTable.rows).toMatchObject([
            { label: "Fruit", time: "2009", value: "573" },
            { label: "Vegetables", time: "2009", value: "542" },
        ])

        // Check that the colors are unique
        const colors = dataTable.rows.map((row) => row.color)
        expect(new Set(colors)).toHaveLength(colors!.length)
    })

    it("highlights focused entities", () => {
        const selectedEntityNames = ["Philippines", "Benin", "Eritrea"]
        const grapherState = createSingleIndicatorGrapherState({
            chartTypes: [GRAPHER_CHART_TYPES.StackedArea],
            selectedEntityNames,
            focusedSeriesNames: [selectedEntityNames[1]],
        })

        const result = buildChartHitDataTableContent({ grapherState })

        expect(result?.type).toBe("data-table")
        const dataTable = result?.props as SearchChartHitDataTableProps

        expect(dataTable.rows).toMatchObject([
            { label: "Philippines", muted: true },
            { label: "Benin", muted: false },
            { label: "Eritrea", muted: true },
        ])
    })

    it("lists all entities in facets when each facet plots a single entity", () => {
        const grapherState = createSingleIndicatorGrapherState({
            chartTypes: [GRAPHER_CHART_TYPES.StackedArea],
            selectedFacetStrategy: FacetStrategy.entity,
        })

        const result = buildChartHitDataTableContent({ grapherState })

        expect(result?.type).toBe("data-table")
        const dataTable = result?.props as SearchChartHitDataTableProps

        expect(dataTable.title).toBe("GDP")
        expect(dataTable.rows).toMatchObject([
            { label: "Benin", time: "2009", value: "$233.42 billion" },
            { label: "Philippines", time: "2009", value: "$682.03 billion" },
            { label: "Eritrea", time: "2009", value: "$63.2 billion" },
        ])
    })

    it("lists entities of the first facet when each facet plots multiple entities", () => {
        const grapherState = createMultipleIndicatorsGrapherState({
            chartTypes: [GRAPHER_CHART_TYPES.StackedArea],
            selectedFacetStrategy: FacetStrategy.metric,
        })

        const result = buildChartHitDataTableContent({ grapherState })

        expect(result?.type).toBe("data-table")
        const dataTable = result?.props as SearchChartHitDataTableProps

        expect(dataTable.title).toBe("GDP")
        expect(dataTable.rows).toMatchObject([
            { label: "Benin", time: "2009", value: "$233.42 billion" },
            { label: "Philippines", time: "2009", value: "$682.03 billion" },
            { label: "Eritrea", time: "2009", value: "$63.2 billion" },
        ])

        // Check that the colors are unique
        const colors = dataTable.rows.map((row) => row.color)
        expect(new Set(colors)).toHaveLength(colors!.length)
    })
})

describe("buildChartHitDataTableContent for DiscreteBar", () => {
    it("lists entities when entities are plotted", () => {
        const grapherState = createSingleIndicatorGrapherState({
            chartTypes: [GRAPHER_CHART_TYPES.DiscreteBar],
        })

        const result = buildChartHitDataTableContent({ grapherState })

        expect(result?.type).toBe("data-table")
        const dataTable = result?.props as SearchChartHitDataTableProps

        expect(dataTable.title).toBe("GDP")
        expect(dataTable.rows).toMatchObject([
            { label: "Philippines", time: "2009", value: "$682.03 billion" },
            { label: "Benin", time: "2009", value: "$233.42 billion" },
            { label: "Eritrea", time: "2009", value: "$63.2 billion" },
        ])
    })

    it("lists columns when columns are plotted", () => {
        const grapherState = createFruityMultipleIndicatorsGrapherState({
            chartTypes: [GRAPHER_CHART_TYPES.DiscreteBar],
        })

        const result = buildChartHitDataTableContent({ grapherState })

        expect(result?.type).toBe("data-table")
        const dataTable = result?.props as SearchChartHitDataTableProps

        expect(dataTable.title).toBe("Benin")
        expect(dataTable.rows).toMatchObject([
            { label: "Fruit", time: "2009", value: "573" },
            { label: "Vegetables", time: "2009", value: "542" },
        ])
    })

    it("highlights focused entities", () => {
        const selectedEntityNames = ["Philippines", "Benin", "Eritrea"]
        const grapherState = createSingleIndicatorGrapherState({
            chartTypes: [GRAPHER_CHART_TYPES.DiscreteBar],
            selectedEntityNames,
            focusedSeriesNames: [selectedEntityNames[1]],
        })

        const result = buildChartHitDataTableContent({ grapherState })

        expect(result?.type).toBe("data-table")
        const dataTable = result?.props as SearchChartHitDataTableProps

        expect(dataTable.rows).toMatchObject([
            { label: "Philippines", muted: true },
            { label: "Benin", muted: false },
            { label: "Eritrea", muted: true },
        ])
    })

    it("lists all entities in facets when each facet plots a single entity", () => {
        const grapherState = createSingleIndicatorGrapherState({
            chartTypes: [GRAPHER_CHART_TYPES.DiscreteBar],
            selectedFacetStrategy: FacetStrategy.entity,
        })

        const result = buildChartHitDataTableContent({ grapherState })

        expect(result?.type).toBe("data-table")
        const dataTable = result?.props as SearchChartHitDataTableProps

        expect(dataTable.title).toBe("GDP")
        expect(dataTable.rows).toMatchObject([
            { label: "Philippines", time: "2009", value: "$682.03 billion" },
            { label: "Benin", time: "2009", value: "$233.42 billion" },
            { label: "Eritrea", time: "2009", value: "$63.2 billion" },
        ])
    })

    it("lists entities of the first facet when each facet plots multiple entities", () => {
        const grapherState = createMultipleIndicatorsGrapherState({
            chartTypes: [GRAPHER_CHART_TYPES.DiscreteBar],
            selectedFacetStrategy: FacetStrategy.metric,
        })

        const result = buildChartHitDataTableContent({ grapherState })

        expect(result?.type).toBe("data-table")
        const dataTable = result?.props as SearchChartHitDataTableProps

        expect(dataTable.title).toBe("GDP")
        expect(dataTable.rows).toMatchObject([
            { label: "Philippines", time: "2009", value: "$682.03 billion" },
            { label: "Benin", time: "2009", value: "$233.42 billion" },
            { label: "Eritrea", time: "2009", value: "$63.2 billion" },
        ])
    })
})

describe("buildChartHitDataTableContent for WorldMap", () => {
    it("shows the map legend", () => {
        const grapherState = createSingleIndicatorGrapherState({
            chartTypes: [],
            hasMapTab: true,
            map: {
                colorScale: {
                    baseColorScheme: ColorSchemeName.Blues,
                    binningStrategy: BinningStrategy.manual,
                    customNumericValues: [
                        1000000000, 3000000000, 5000000000, 7000000000,
                        9000000000, 1000000000,
                    ],
                },
            },
        })

        const result = buildChartHitDataTableContent({ grapherState })

        expect(result?.type).toBe("data-table")
        const dataTable = result?.props as SearchChartHitDataTableProps

        expect(dataTable.title).toBe("GDP")
        expect(dataTable.rows).toMatchObject([
            {
                color: "#eff3ff",
                label: "$1 billion-$3 billion",
                outlined: true,
                striped: false,
                time: "2009",
            },
            {
                color: "#bdd7e7",
                label: "$3 billion-$5 billion",
                outlined: true,
                striped: false,
                time: "2009",
            },
            {
                color: "#6baed6",
                label: "$5 billion-$7 billion",
                outlined: true,
                striped: false,
                time: "2009",
            },
            {
                color: "#3182bd",
                label: "$7 billion-$9 billion",
                outlined: true,
                striped: false,
                time: "2009",
            },
            {
                color: "#08519c",
                label: ">$9 billion",
                outlined: true,
                striped: false,
                time: "2009",
            },
            {
                color: "#6e7581",
                label: "No data",
                outlined: true,
                striped: "no-data",
                time: "2009",
            },
        ])
    })
})
