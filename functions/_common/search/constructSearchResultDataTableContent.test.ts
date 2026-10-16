import { describe, it, expect } from "vitest"
import {
    GrapherState,
    GrapherProgrammaticInterface,
    SwimlaneChartState,
} from "@ourworldindata/grapher"
import {
    FacetStrategy,
    DimensionProperty,
    EntitySelectionMode,
    GRAPHER_CHART_TYPES,
    ColorSchemeName,
    ColumnTypeNames,
} from "@ourworldindata/types"
import {
    SynthesizeGDPTable,
    SampleColumnSlugs,
    SynthesizeFruitTable,
    OwidTable,
} from "@ourworldindata/core-table"
import { constructSearchResultDataTableContent } from "./constructSearchResultDataTableContent.js"

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

describe("constructSearchResultDataTableContent for LineChart", () => {
    it("lists entities when entities are plotted", () => {
        const grapherState = createSingleIndicatorGrapherState()

        const dataTable = constructSearchResultDataTableContent({
            grapherState,
        })

        expect(dataTable!.title).toBe("GDP")
        expect(dataTable!.rows).toMatchObject([
            { label: "Philippines", time: "2009", value: "$682 billion" },
            { label: "Benin", time: "2009", value: "$233 billion" },
            { label: "Eritrea", time: "2009", value: "$63.2 billion" },
        ])

        // Check that the colors are unique
        const colors = dataTable!.rows.map((row) => row.color)
        expect(new Set(colors)).toHaveLength(colors.length)
    })

    it("lists columns when columns are plotted", () => {
        const grapherState = createFruityMultipleIndicatorsGrapherState()

        const dataTable = constructSearchResultDataTableContent({
            grapherState,
        })

        expect(dataTable!.title).toBe("Benin")
        expect(dataTable!.rows).toMatchObject([
            { label: "Fruit", time: "2009", value: "573" },
            { label: "Vegetables", time: "2009", value: "542" },
        ])

        // Check that the colors are unique
        const colors = dataTable!.rows.map((row) => row.color)
        expect(new Set(colors)).toHaveLength(colors.length)
    })

    it("highlights focused entities", () => {
        const selectedEntityNames = ["Philippines", "Benin", "Eritrea"]
        const grapherState = createSingleIndicatorGrapherState({
            selectedEntityNames,
            focusedSeriesNames: [selectedEntityNames[1]],
        })

        const dataTable = constructSearchResultDataTableContent({
            grapherState,
        })

        expect(dataTable!.rows).toMatchObject([
            { label: "Philippines", muted: true },
            { label: "Benin", muted: false },
            { label: "Eritrea", muted: true },
        ])
    })

    it("lists all entities in facets when each facet plots a single entity", () => {
        const grapherState = createSingleIndicatorGrapherState({
            selectedFacetStrategy: FacetStrategy.entity,
        })

        const dataTable = constructSearchResultDataTableContent({
            grapherState,
        })

        expect(dataTable!.title).toBe("GDP")
        expect(dataTable!.rows).toMatchObject([
            { label: "Philippines", time: "2009", value: "$682 billion" },
            { label: "Benin", time: "2009", value: "$233 billion" },
            { label: "Eritrea", time: "2009", value: "$63.2 billion" },
        ])
    })

    it("lists entities of the first facet when each facet plots multiple entities", () => {
        const grapherState = createMultipleIndicatorsGrapherState({
            selectedFacetStrategy: FacetStrategy.metric,
        })

        const dataTable = constructSearchResultDataTableContent({
            grapherState,
        })

        expect(dataTable!.title).toBe("GDP")
        expect(dataTable!.rows).toMatchObject([
            { label: "Philippines", time: "2009", value: "$682 billion" },
            { label: "Benin", time: "2009", value: "$233 billion" },
            { label: "Eritrea", time: "2009", value: "$63.2 billion" },
        ])

        // Check that the colors are unique
        const colors = dataTable!.rows.map((row) => row.color)
        expect(new Set(colors)).toHaveLength(colors.length)
    })
})

describe("constructSearchResultDataTableContent for SlopeChart", () => {
    it("lists entities when entities are plotted", () => {
        const grapherState = createSingleIndicatorGrapherState({
            chartTypes: [GRAPHER_CHART_TYPES.SlopeChart],
        })

        const dataTable = constructSearchResultDataTableContent({
            grapherState,
        })

        expect(dataTable!.title).toBe("GDP")
        expect(dataTable!.rows).toMatchObject([
            {
                label: "Philippines",
                time: "2000–2009",
                startValue: "$664 billion",
                value: "$682 billion",
                trend: "up",
            },
            {
                label: "Benin",
                time: "2000–2009",
                startValue: "$253 billion",
                value: "$233 billion",
                trend: "down",
            },
            {
                label: "Eritrea",
                time: "2000–2009",
                value: "$63.2 billion",
                startValue: "$69.3 billion",
                trend: "down",
            },
        ])

        // Check that the colors are unique
        const colors = dataTable!.rows.map((row) => row.color)
        expect(new Set(colors)).toHaveLength(colors.length)
    })

    it("lists columns when columns are plotted", () => {
        const grapherState = createFruityMultipleIndicatorsGrapherState({
            chartTypes: [GRAPHER_CHART_TYPES.SlopeChart],
        })

        const dataTable = constructSearchResultDataTableContent({
            grapherState,
        })

        expect(dataTable!.title).toBe("Benin")
        expect(dataTable!.rows).toMatchObject([
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
        const colors = dataTable!.rows.map((row) => row.color)
        expect(new Set(colors)).toHaveLength(colors.length)
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

        const dataTable = constructSearchResultDataTableContent({
            grapherState,
        })

        expect(dataTable!.title).toBe("GDP")
        expect(dataTable!.rows).toMatchObject([
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

        const dataTable = constructSearchResultDataTableContent({
            grapherState,
        })

        expect(dataTable!.title).toBe("GDP")
        expect(dataTable!.rows).toMatchObject([
            {
                label: "Philippines",
                startValue: "$664 billion",
                value: "$682 billion",
                time: "2000–2009",
                trend: "up",
            },
            {
                label: "Benin",
                startValue: "$253 billion",
                value: "$233 billion",
                time: "2000–2009",
                trend: "down",
            },
            {
                label: "Eritrea",
                startValue: "$69.3 billion",
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

        const dataTable = constructSearchResultDataTableContent({
            grapherState,
        })

        expect(dataTable!.title).toBe("GDP")
        expect(dataTable!.rows).toMatchObject([
            {
                label: "Philippines",
                startValue: "$664 billion",
                value: "$682 billion",
                time: "2000–2009",
                trend: "up",
            },
            {
                label: "Benin",
                startValue: "$253 billion",
                value: "$233 billion",
                time: "2000–2009",
                trend: "down",
            },
            {
                label: "Eritrea",
                startValue: "$69.3 billion",
                value: "$63.2 billion",
                time: "2000–2009",
                trend: "down",
            },
        ])

        // Check that the colors are unique
        const colors = dataTable!.rows.map((row) => row.color)
        expect(new Set(colors)).toHaveLength(colors.length)
    })
})

describe("constructSearchResultDataTableContent for DumbbellChart", () => {
    it("compares a column's values across two time points (entity strategy)", () => {
        const grapherState = createSingleIndicatorGrapherState({
            chartTypes: [GRAPHER_CHART_TYPES.Dumbbell],
        })

        const dataTable = constructSearchResultDataTableContent({
            grapherState,
        })

        expect(dataTable!.title).toBe("GDP")
        expect(dataTable!.rows).toMatchObject([
            {
                label: "Philippines",
                time: "2000–2009",
                startValue: "$664 billion",
                value: "$682 billion",
                trend: "up",
            },
            {
                label: "Benin",
                time: "2000–2009",
                startValue: "$253 billion",
                value: "$233 billion",
                trend: "down",
            },
            {
                label: "Eritrea",
                time: "2000–2009",
                startValue: "$69.3 billion",
                value: "$63.2 billion",
                trend: "down",
            },
        ])
    })

    it("compares two columns at a single time point (column strategy)", () => {
        const grapherState = createFruityMultipleIndicatorsGrapherState({
            chartTypes: [GRAPHER_CHART_TYPES.Dumbbell],
            addCountryMode: EntitySelectionMode.MultipleEntities,
            selectedEntityNames: ["Benin", "Philippines", "Eritrea"],
        })

        const dataTable = constructSearchResultDataTableContent({
            grapherState,
        })

        expect(dataTable!.title).toBe("Fruit vs. Vegetables")
        expect(dataTable!.rows).toMatchObject([
            {
                label: "Philippines",
                startValue: "844",
                time: "2009",
                timePreposition: "in",
                value: "893",
            },
            {
                label: "Benin",
                startValue: "573",
                time: "2009",
                timePreposition: "in",
                value: "542",
            },
            {
                label: "Eritrea",
                startValue: "479",
                time: "2009",
                timePreposition: "in",
                value: "430",
            },
        ])
    })
})

describe("constructSearchResultDataTableContent for StackedAreaChart", () => {
    it("lists entities when entities are plotted", () => {
        const grapherState = createSingleIndicatorGrapherState({
            chartTypes: [GRAPHER_CHART_TYPES.StackedArea],
        })

        const dataTable = constructSearchResultDataTableContent({
            grapherState,
        })

        expect(dataTable!.title).toBe("GDP")
        expect(dataTable!.rows).toMatchObject([
            { label: "Benin", time: "2009", value: "$233 billion" },
            { label: "Philippines", time: "2009", value: "$682 billion" },
            { label: "Eritrea", time: "2009", value: "$63.2 billion" },
        ])

        // Check that the colors are unique
        const colors = dataTable!.rows.map((row) => row.color)
        expect(new Set(colors)).toHaveLength(colors.length)
    })

    it("lists columns when columns are plotted", () => {
        const grapherState = createFruityMultipleIndicatorsGrapherState({
            chartTypes: [GRAPHER_CHART_TYPES.StackedArea],
        })

        const dataTable = constructSearchResultDataTableContent({
            grapherState,
        })

        expect(dataTable!.title).toBe("Benin")
        expect(dataTable!.rows).toMatchObject([
            { label: "Fruit", time: "2009", value: "573" },
            { label: "Vegetables", time: "2009", value: "542" },
        ])

        // Check that the colors are unique
        const colors = dataTable!.rows.map((row) => row.color)
        expect(new Set(colors)).toHaveLength(colors.length)
    })

    it("highlights focused entities", () => {
        const selectedEntityNames = ["Philippines", "Benin", "Eritrea"]
        const grapherState = createSingleIndicatorGrapherState({
            chartTypes: [GRAPHER_CHART_TYPES.StackedArea],
            selectedEntityNames,
            focusedSeriesNames: [selectedEntityNames[1]],
        })

        const dataTable = constructSearchResultDataTableContent({
            grapherState,
        })

        expect(dataTable!.rows).toMatchObject([
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

        const dataTable = constructSearchResultDataTableContent({
            grapherState,
        })

        expect(dataTable!.title).toBe("GDP")
        expect(dataTable!.rows).toMatchObject([
            { label: "Benin", time: "2009", value: "$233 billion" },
            { label: "Philippines", time: "2009", value: "$682 billion" },
            { label: "Eritrea", time: "2009", value: "$63.2 billion" },
        ])
    })

    it("lists entities of the first facet when each facet plots multiple entities", () => {
        const grapherState = createMultipleIndicatorsGrapherState({
            chartTypes: [GRAPHER_CHART_TYPES.StackedArea],
            selectedFacetStrategy: FacetStrategy.metric,
        })

        const dataTable = constructSearchResultDataTableContent({
            grapherState,
        })

        expect(dataTable!.title).toBe("GDP")
        expect(dataTable!.rows).toMatchObject([
            { label: "Benin", time: "2009", value: "$233 billion" },
            { label: "Philippines", time: "2009", value: "$682 billion" },
            { label: "Eritrea", time: "2009", value: "$63.2 billion" },
        ])

        // Check that the colors are unique
        const colors = dataTable!.rows.map((row) => row.color)
        expect(new Set(colors)).toHaveLength(colors.length)
    })
})

describe("constructSearchResultDataTableContent for DiscreteBar", () => {
    it("lists entities when entities are plotted", () => {
        const grapherState = createSingleIndicatorGrapherState({
            chartTypes: [GRAPHER_CHART_TYPES.DiscreteBar],
        })

        const dataTable = constructSearchResultDataTableContent({
            grapherState,
        })

        expect(dataTable!.title).toBe("GDP")
        expect(dataTable!.rows).toMatchObject([
            { label: "Philippines", time: "2009", value: "$682 billion" },
            { label: "Benin", time: "2009", value: "$233 billion" },
            { label: "Eritrea", time: "2009", value: "$63.2 billion" },
        ])
    })

    it("lists columns when columns are plotted", () => {
        const grapherState = createFruityMultipleIndicatorsGrapherState({
            chartTypes: [GRAPHER_CHART_TYPES.DiscreteBar],
        })

        const dataTable = constructSearchResultDataTableContent({
            grapherState,
        })

        expect(dataTable!.title).toBe("Benin")
        expect(dataTable!.rows).toMatchObject([
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

        const dataTable = constructSearchResultDataTableContent({
            grapherState,
        })

        expect(dataTable!.rows).toMatchObject([
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

        const dataTable = constructSearchResultDataTableContent({
            grapherState,
        })

        expect(dataTable!.title).toBe("GDP")
        expect(dataTable!.rows).toMatchObject([
            { label: "Philippines", time: "2009", value: "$682 billion" },
            { label: "Benin", time: "2009", value: "$233 billion" },
            { label: "Eritrea", time: "2009", value: "$63.2 billion" },
        ])
    })

    it("lists entities of the first facet when each facet plots multiple entities", () => {
        const grapherState = createMultipleIndicatorsGrapherState({
            chartTypes: [GRAPHER_CHART_TYPES.DiscreteBar],
            selectedFacetStrategy: FacetStrategy.metric,
        })

        const dataTable = constructSearchResultDataTableContent({
            grapherState,
        })

        expect(dataTable!.title).toBe("GDP")
        expect(dataTable!.rows).toMatchObject([
            { label: "Philippines", time: "2009", value: "$682 billion" },
            { label: "Benin", time: "2009", value: "$233 billion" },
            { label: "Eritrea", time: "2009", value: "$63.2 billion" },
        ])
    })
})

describe("constructSearchResultDataTableContent for WorldMap", () => {
    it("shows the map legend", () => {
        const grapherState = createSingleIndicatorGrapherState({
            chartTypes: [],
            hasMapTab: true,
            map: {
                colorScale: {
                    baseColorScheme: ColorSchemeName.Blues,
                    binningStrategy: "manual",
                    customNumericValues: [
                        1000000000, 3000000000, 5000000000, 7000000000,
                        9000000000, 1000000000,
                    ],
                },
            },
        })

        const dataTable = constructSearchResultDataTableContent({
            grapherState,
        })

        expect(dataTable!.title).toBe("GDP")
        expect(dataTable!.rows).toMatchObject([
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

describe("constructSearchResultDataTableContent for Swimlane", () => {
    function createSwimlaneGrapherState(
        rows: { entityName: string; time: number; status: string }[],
        overrides: GrapherProgrammaticInterface = {}
    ): GrapherState {
        const table = new OwidTable(rows, [
            { slug: "time", type: ColumnTypeNames.Year },
            { slug: "status", type: ColumnTypeNames.String },
        ])

        return new GrapherState({
            table,
            chartTypes: [GRAPHER_CHART_TYPES.Swimlane],
            selectedEntityNames: table.availableEntityNames,
            dimensions: [
                {
                    slug: "status",
                    property: DimensionProperty.y,
                    variableId: "status" as any,
                },
            ],
            ...overrides,
        })
    }

    const rows = [
        { entityName: "France", time: 2000, status: "A" },
        { entityName: "France", time: 2001, status: "B" },
        { entityName: "Germany", time: 2000, status: "B" },
        { entityName: "Germany", time: 2001, status: "B" },
        { entityName: "Italy", time: 2000, status: "A" },
        { entityName: "Italy", time: 2001, status: "A" },
    ]

    it("shows each lane's last category and its color", () => {
        const grapherState = createSwimlaneGrapherState(rows)
        const { colorScale } = grapherState.chartState as SwimlaneChartState

        const dataTable = constructSearchResultDataTableContent({
            grapherState,
        })

        expect(dataTable!.rows).toMatchObject([
            { label: "France", value: "B", color: colorScale.getColor("B") },
            { label: "Germany", value: "B", color: colorScale.getColor("B") },
            { label: "Italy", value: "A", color: colorScale.getColor("A") },
        ])
    })

    it("shows the last observed category when the last time has no observation", () => {
        const grapherState = createSwimlaneGrapherState([
            { entityName: "France", time: 2000, status: "A" },
            { entityName: "France", time: 2001, status: "B" },
            { entityName: "Germany", time: 2000, status: "B" },
            { entityName: "Germany", time: 2001, status: "A" },
            { entityName: "Italy", time: 2000, status: "A" },
        ])

        const dataTable = constructSearchResultDataTableContent({
            grapherState,
        })

        expect(dataTable!.rows).toMatchObject([
            { label: "France", value: "B" },
            { label: "Germany", value: "A" },
            { label: "Italy", value: "A" },
        ])
    })

    it("shows 'No data' for a lane without a category in view", () => {
        const grapherState = createSwimlaneGrapherState(rows, {
            selectedEntityNames: ["France", "Spain"],
        })
        const { colorScale } = grapherState.chartState as SwimlaneChartState

        const dataTable = constructSearchResultDataTableContent({
            grapherState,
        })

        expect(dataTable!.rows).toMatchObject([
            { label: "France", value: "B" },
            {
                label: "Spain",
                value: "No data",
                color: colorScale.noDataColor,
                striped: "no-data",
            },
        ])
    })

    it("gives each row the time of its latest category", () => {
        const grapherState = createSwimlaneGrapherState([
            { entityName: "France", time: 2000, status: "A" },
            { entityName: "France", time: 2001, status: "B" },
            { entityName: "France", time: 2002, status: "B" },
            { entityName: "Italy", time: 2000, status: "A" },
            { entityName: "Italy", time: 2001, status: "B" },
        ])

        const dataTable = constructSearchResultDataTableContent({
            grapherState,
        })

        expect(dataTable!.rows).toMatchObject([
            {
                label: "France",
                value: "B",
                time: "2002",
                timePreposition: "in",
            },
            { label: "Italy", value: "B", time: "2001", timePreposition: "in" },
        ])
    })

    it("gives each row the last time in view when the timeline ends early", () => {
        const grapherState = createSwimlaneGrapherState(
            [
                { entityName: "France", time: 2000, status: "A" },
                { entityName: "France", time: 2001, status: "A" },
                { entityName: "France", time: 2002, status: "A" },
            ],
            { maxTime: 2001 }
        )

        const dataTable = constructSearchResultDataTableContent({
            grapherState,
        })

        expect(dataTable!.rows).toMatchObject([
            { label: "France", value: "A", time: "2001" },
        ])
    })

    it("gives 'No data' rows no time", () => {
        const grapherState = createSwimlaneGrapherState(rows, {
            selectedEntityNames: ["France", "Spain"],
        })

        const dataTable = constructSearchResultDataTableContent({
            grapherState,
        })

        const spain = dataTable!.rows.find((row) => row.label === "Spain")
        expect(spain).not.toHaveProperty("time")
        expect(spain).not.toHaveProperty("timePreposition")
    })

    it("mutes the rows of entities that are not focused", () => {
        const grapherState = createSwimlaneGrapherState(rows, {
            focusedSeriesNames: ["Germany"],
        })

        const dataTable = constructSearchResultDataTableContent({
            grapherState,
        })

        expect(dataTable!.rows).toMatchObject([
            { label: "France", muted: true },
            { label: "Germany", muted: false },
            { label: "Italy", muted: true },
        ])
    })

    it("caps the rows at maxRows", () => {
        const grapherState = createSwimlaneGrapherState(rows)

        const dataTable = constructSearchResultDataTableContent({
            grapherState,
            maxRows: 2,
        })

        expect(dataTable!.rows.map((row) => row.label)).toEqual([
            "France",
            "Germany",
        ])
    })
})
