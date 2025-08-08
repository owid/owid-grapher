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
import { buildChartHitDataTableProps } from "./SearchChartHitDataTableHelpers"
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

describe("buildChartHitDataTableProps for LineChart", () => {
    it("lists entities when entities are plotted", () => {
        const grapherState = createSingleIndicatorGrapherState()

        const result = buildChartHitDataTableProps({ grapherState })

        expect(result?.type).toBe("data-table")
        const dataTable = result as SearchChartHitDataTableProps

        expect(dataTable.title).toBe("GDP")
        expect(dataTable.rows).toMatchObject([
            { name: "Philippines", time: "2009", value: "$682.03 billion" },
            { name: "Benin", time: "2009", value: "$233.42 billion" },
            { name: "Eritrea", time: "2009", value: "$63.2 billion" },
        ])

        // Check that the colors are unique
        const colors = dataTable.rows.map((row) => row.color)
        expect(new Set(colors)).toHaveLength(colors!.length)
    })

    it("lists columns when columns are plotted", () => {
        const grapherState = createFruityMultipleIndicatorsGrapherState()

        const result = buildChartHitDataTableProps({ grapherState })

        expect(result?.type).toBe("data-table")
        const dataTable = result as SearchChartHitDataTableProps

        expect(dataTable.title).toBe("Benin")
        expect(dataTable.rows).toMatchObject([
            { name: "Fruit", time: "2009", value: "573" },
            { name: "Vegetables", time: "2009", value: "542" },
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

        const result = buildChartHitDataTableProps({ grapherState })

        expect(result?.type).toBe("data-table")
        const dataTable = result as SearchChartHitDataTableProps

        expect(dataTable.rows).toMatchObject([
            { name: "Philippines", muted: true },
            { name: "Benin", muted: false },
            { name: "Eritrea", muted: true },
        ])
    })

    it("lists all entities in facets when each facet plots a single entity", () => {
        const grapherState = createSingleIndicatorGrapherState({
            selectedFacetStrategy: FacetStrategy.entity,
        })

        const result = buildChartHitDataTableProps({ grapherState })

        expect(result?.type).toBe("data-table")
        const dataTable = result as SearchChartHitDataTableProps

        expect(dataTable.title).toBe("GDP")
        expect(dataTable.rows).toMatchObject([
            { name: "Philippines", time: "2009", value: "$682.03 billion" },
            { name: "Benin", time: "2009", value: "$233.42 billion" },
            { name: "Eritrea", time: "2009", value: "$63.2 billion" },
        ])
    })

    it("lists entities of the first facet when each facet plots multiple entities", () => {
        const grapherState = createMultipleIndicatorsGrapherState({
            selectedFacetStrategy: FacetStrategy.metric,
        })

        const result = buildChartHitDataTableProps({ grapherState })

        expect(result?.type).toBe("data-table")
        const dataTable = result as SearchChartHitDataTableProps

        expect(dataTable.title).toBe("GDP")
        expect(dataTable.rows).toMatchObject([
            { name: "Philippines", time: "2009", value: "$682.03 billion" },
            { name: "Benin", time: "2009", value: "$233.42 billion" },
            { name: "Eritrea", time: "2009", value: "$63.2 billion" },
        ])

        // Check that the colors are unique
        const colors = dataTable.rows.map((row) => row.color)
        expect(new Set(colors)).toHaveLength(colors!.length)
    })
})

describe("buildChartHitDataTableProps for SlopeChart", () => {
    it("lists entities when entities are plotted", () => {
        const grapherState = createSingleIndicatorGrapherState({
            chartTypes: [GRAPHER_CHART_TYPES.SlopeChart],
        })

        const result = buildChartHitDataTableProps({ grapherState })

        expect(result?.type).toBe("data-table")
        const dataTable = result as SearchChartHitDataTableProps

        expect(dataTable.title).toBe("GDP")
        expect(dataTable.rows).toMatchObject([
            {
                name: "Philippines",
                time: "2000–2009",
                startValue: "$663.99 billion",
                value: "$682.03 billion",
                trend: "up",
            },
            {
                name: "Benin",
                time: "2000–2009",
                startValue: "$252.54 billion",
                value: "$233.42 billion",
                trend: "down",
            },
            {
                name: "Eritrea",
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

        const result = buildChartHitDataTableProps({ grapherState })

        expect(result?.type).toBe("data-table")
        const dataTable = result as SearchChartHitDataTableProps

        expect(dataTable.title).toBe("Benin")
        expect(dataTable.rows).toMatchObject([
            {
                name: "Fruit",
                time: "2000–2009",
                startValue: "603",
                value: "573",
                trend: "down",
            },
            {
                name: "Vegetables",
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

        const result = buildChartHitDataTableProps({ grapherState })

        expect(result?.type).toBe("data-table")
        const dataTable = result as SearchChartHitDataTableProps

        expect(dataTable.title).toBe("GDP")
        expect(dataTable.rows).toMatchObject([
            { name: "Philippines", muted: true },
            { name: "Benin", muted: false },
            { name: "Eritrea", muted: true },
        ])
    })

    it("lists all entities in facets when each facet plots a single entity", () => {
        const grapherState = createSingleIndicatorGrapherState({
            chartTypes: [GRAPHER_CHART_TYPES.SlopeChart],
            selectedFacetStrategy: FacetStrategy.entity,
        })

        const result = buildChartHitDataTableProps({ grapherState })

        expect(result?.type).toBe("data-table")
        const dataTable = result as SearchChartHitDataTableProps

        expect(dataTable.title).toBe("GDP")
        expect(dataTable.rows).toMatchObject([
            {
                name: "Philippines",
                startValue: "$663.99 billion",
                value: "$682.03 billion",
                time: "2000–2009",
                trend: "up",
            },
            {
                name: "Benin",
                startValue: "$252.54 billion",
                value: "$233.42 billion",
                time: "2000–2009",
                trend: "down",
            },
            {
                name: "Eritrea",
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

        const result = buildChartHitDataTableProps({ grapherState })

        expect(result?.type).toBe("data-table")
        const dataTable = result as SearchChartHitDataTableProps

        expect(dataTable.title).toBe("GDP")
        expect(dataTable.rows).toMatchObject([
            {
                name: "Philippines",
                startValue: "$663.99 billion",
                value: "$682.03 billion",
                time: "2000–2009",
                trend: "up",
            },
            {
                name: "Benin",
                startValue: "$252.54 billion",
                value: "$233.42 billion",
                time: "2000–2009",
                trend: "down",
            },
            {
                name: "Eritrea",
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

describe("buildChartHitDataTableProps for StackedAreaChart", () => {
    it("lists entities when entities are plotted", () => {
        const grapherState = createSingleIndicatorGrapherState({
            chartTypes: [GRAPHER_CHART_TYPES.StackedArea],
        })

        const result = buildChartHitDataTableProps({ grapherState })

        expect(result?.type).toBe("data-table")
        const dataTable = result as SearchChartHitDataTableProps

        expect(dataTable.title).toBe("GDP")
        expect(dataTable.rows).toMatchObject([
            { name: "Benin", time: "2009", value: "$233.42 billion" },
            { name: "Philippines", time: "2009", value: "$682.03 billion" },
            { name: "Eritrea", time: "2009", value: "$63.2 billion" },
        ])

        // Check that the colors are unique
        const colors = dataTable.rows.map((row) => row.color)
        expect(new Set(colors)).toHaveLength(colors!.length)
    })

    it("lists columns when columns are plotted", () => {
        const grapherState = createFruityMultipleIndicatorsGrapherState({
            chartTypes: [GRAPHER_CHART_TYPES.StackedArea],
        })

        const result = buildChartHitDataTableProps({ grapherState })

        expect(result?.type).toBe("data-table")
        const dataTable = result as SearchChartHitDataTableProps

        expect(dataTable.title).toBe("Benin")
        expect(dataTable.rows).toMatchObject([
            { name: "Fruit", time: "2009", value: "573" },
            { name: "Vegetables", time: "2009", value: "542" },
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

        const result = buildChartHitDataTableProps({ grapherState })

        expect(result?.type).toBe("data-table")
        const dataTable = result as SearchChartHitDataTableProps

        expect(dataTable.rows).toMatchObject([
            { name: "Philippines", muted: true },
            { name: "Benin", muted: false },
            { name: "Eritrea", muted: true },
        ])
    })

    it("lists all entities in facets when each facet plots a single entity", () => {
        const grapherState = createSingleIndicatorGrapherState({
            chartTypes: [GRAPHER_CHART_TYPES.StackedArea],
            selectedFacetStrategy: FacetStrategy.entity,
        })

        const result = buildChartHitDataTableProps({ grapherState })

        expect(result?.type).toBe("data-table")
        const dataTable = result as SearchChartHitDataTableProps

        expect(dataTable.title).toBe("GDP")
        expect(dataTable.rows).toMatchObject([
            { name: "Benin", time: "2009", value: "$233.42 billion" },
            { name: "Philippines", time: "2009", value: "$682.03 billion" },
            { name: "Eritrea", time: "2009", value: "$63.2 billion" },
        ])
    })

    it("lists entities of the first facet when each facet plots multiple entities", () => {
        const grapherState = createMultipleIndicatorsGrapherState({
            chartTypes: [GRAPHER_CHART_TYPES.StackedArea],
            selectedFacetStrategy: FacetStrategy.metric,
        })

        const result = buildChartHitDataTableProps({ grapherState })

        expect(result?.type).toBe("data-table")
        const dataTable = result as SearchChartHitDataTableProps

        expect(dataTable.title).toBe("GDP")
        expect(dataTable.rows).toMatchObject([
            { name: "Benin", time: "2009", value: "$233.42 billion" },
            { name: "Philippines", time: "2009", value: "$682.03 billion" },
            { name: "Eritrea", time: "2009", value: "$63.2 billion" },
        ])

        // Check that the colors are unique
        const colors = dataTable.rows.map((row) => row.color)
        expect(new Set(colors)).toHaveLength(colors!.length)
    })
})

describe("buildChartHitDataTableProps for DiscreteBar", () => {
    it("lists entities when entities are plotted", () => {
        const grapherState = createSingleIndicatorGrapherState({
            chartTypes: [GRAPHER_CHART_TYPES.DiscreteBar],
        })

        const result = buildChartHitDataTableProps({ grapherState })

        expect(result?.type).toBe("data-table")
        const dataTable = result as SearchChartHitDataTableProps

        expect(dataTable.title).toBe("GDP")
        expect(dataTable.rows).toMatchObject([
            { name: "Philippines", time: "2009", value: "$682.03 billion" },
            { name: "Benin", time: "2009", value: "$233.42 billion" },
            { name: "Eritrea", time: "2009", value: "$63.2 billion" },
        ])
    })

    it("lists columns when columns are plotted", () => {
        const grapherState = createFruityMultipleIndicatorsGrapherState({
            chartTypes: [GRAPHER_CHART_TYPES.DiscreteBar],
        })

        const result = buildChartHitDataTableProps({ grapherState })

        expect(result?.type).toBe("data-table")
        const dataTable = result as SearchChartHitDataTableProps

        expect(dataTable.title).toBe("Benin")
        expect(dataTable.rows).toMatchObject([
            { name: "Fruit", time: "2009", value: "573" },
            { name: "Vegetables", time: "2009", value: "542" },
        ])
    })

    it("highlights focused entities", () => {
        const selectedEntityNames = ["Philippines", "Benin", "Eritrea"]
        const grapherState = createSingleIndicatorGrapherState({
            chartTypes: [GRAPHER_CHART_TYPES.DiscreteBar],
            selectedEntityNames,
            focusedSeriesNames: [selectedEntityNames[1]],
        })

        const result = buildChartHitDataTableProps({ grapherState })

        expect(result?.type).toBe("data-table")
        const dataTable = result as SearchChartHitDataTableProps

        expect(dataTable.rows).toMatchObject([
            { name: "Philippines", muted: true },
            { name: "Benin", muted: false },
            { name: "Eritrea", muted: true },
        ])
    })

    it("lists all entities in facets when each facet plots a single entity", () => {
        const grapherState = createSingleIndicatorGrapherState({
            chartTypes: [GRAPHER_CHART_TYPES.DiscreteBar],
            selectedFacetStrategy: FacetStrategy.entity,
        })

        const result = buildChartHitDataTableProps({ grapherState })

        expect(result?.type).toBe("data-table")
        const dataTable = result as SearchChartHitDataTableProps

        expect(dataTable.title).toBe("GDP")
        expect(dataTable.rows).toMatchObject([
            { name: "Philippines", time: "2009", value: "$682.03 billion" },
            { name: "Benin", time: "2009", value: "$233.42 billion" },
            { name: "Eritrea", time: "2009", value: "$63.2 billion" },
        ])
    })

    it("lists entities of the first facet when each facet plots multiple entities", () => {
        const grapherState = createMultipleIndicatorsGrapherState({
            chartTypes: [GRAPHER_CHART_TYPES.DiscreteBar],
            selectedFacetStrategy: FacetStrategy.metric,
        })

        const result = buildChartHitDataTableProps({ grapherState })

        expect(result?.type).toBe("data-table")
        const dataTable = result as SearchChartHitDataTableProps

        expect(dataTable.title).toBe("GDP")
        expect(dataTable.rows).toMatchObject([
            { name: "Philippines", time: "2009", value: "$682.03 billion" },
            { name: "Benin", time: "2009", value: "$233.42 billion" },
            { name: "Eritrea", time: "2009", value: "$63.2 billion" },
        ])
    })
})

describe("buildChartHitDataTableProps for WorldMap", () => {
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

        const result = buildChartHitDataTableProps({ grapherState })

        expect(result?.type).toBe("data-table")
        const dataTable = result as SearchChartHitDataTableProps

        expect(dataTable.title).toBe("GDP")
        expect(dataTable.rows).toMatchObject([
            {
                color: "#eff3ff",
                name: "$1 billion-$3 billion",
                outlined: true,
                striped: false,
                time: "2009",
            },
            {
                color: "#bdd7e7",
                name: "$3 billion-$5 billion",
                outlined: true,
                striped: false,
                time: "2009",
            },
            {
                color: "#6baed6",
                name: "$5 billion-$7 billion",
                outlined: true,
                striped: false,
                time: "2009",
            },
            {
                color: "#3182bd",
                name: "$7 billion-$9 billion",
                outlined: true,
                striped: false,
                time: "2009",
            },
            {
                color: "#08519c",
                name: ">$9 billion",
                outlined: true,
                striped: false,
                time: "2009",
            },
            {
                color: "#6e7581",
                name: "No data",
                outlined: true,
                striped: "no-data",
                time: "2009",
            },
        ])
    })
})
