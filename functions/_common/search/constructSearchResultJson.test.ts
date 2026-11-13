import { expect, it, describe } from "vitest"
import {
    GRAPHER_TAB_NAMES,
    EntitySelectionMode,
    SeriesStrategy,
    FacetStrategy,
    DimensionProperty,
    GRAPHER_CHART_TYPES,
    PeerCountryStrategy,
    AdditionalGrapherDataFetchFn,
    ColumnTypeNames,
    GrapherSearchResultJson,
} from "@ourworldindata/types"
import {
    GrapherState,
    GrapherProgrammaticInterface,
    WORLD_ENTITY_NAME,
} from "@ourworldindata/grapher"
import {
    OwidTable,
    SampleColumnSlugs,
    SynthesizeGDPTable,
} from "@ourworldindata/core-table"
import {
    selectRegionGroupByPriority,
    getSortedGrapherTabsForChartHit,
    pickDisplayEntities,
    configureGrapherStateTab,
    constructSearchResultJson,
    RichDataVariant,
} from "./constructSearchResultJson.js"

describe(getSortedGrapherTabsForChartHit, () => {
    const {
        LineChart,
        Table,
        WorldMap,
        SlopeChart,
        StackedArea,
        StackedBar,
        StackedDiscreteBar,
        DiscreteBar,
        Marimekko,
    } = GRAPHER_TAB_NAMES

    it("should return LineChart/Table/DiscreteBar when GrapherState is initialized with no options", () => {
        const grapherState = new GrapherState({})
        const result = getSortedGrapherTabsForChartHit(grapherState)
        expect(result).toEqual([LineChart, Table, DiscreteBar])
    })

    it("should position WorldMap after LineChart and Table when hasMapTab is true", () => {
        const grapherState = new GrapherState({ hasMapTab: true })
        const result = getSortedGrapherTabsForChartHit(grapherState)
        expect(result).toEqual([LineChart, Table, WorldMap, DiscreteBar])
    })

    it("should show LineChart as first tab even when map is set as default tab", () => {
        const grapherState = new GrapherState({ hasMapTab: true, tab: "map" })
        const result = getSortedGrapherTabsForChartHit(grapherState)
        expect(result).toEqual([LineChart, Table, WorldMap, DiscreteBar])
    })

    it("should show Table when there are no other chart types (edge case)", () => {
        const grapherState = new GrapherState({ chartTypes: [] })
        const result = getSortedGrapherTabsForChartHit(grapherState)
        expect(result).toEqual([Table])
    })

    it("should show WorldMap as first tab when it's the only available chart type", () => {
        const grapherState = new GrapherState({
            chartTypes: [],
            hasMapTab: true,
        })
        const result = getSortedGrapherTabsForChartHit(grapherState)
        expect(result).toEqual([WorldMap, Table])
    })

    it("should prioritise Marimekkos over slope charts", () => {
        const grapherState = new GrapherState({
            chartTypes: [LineChart, SlopeChart, Marimekko],
            hasMapTab: true,
            tab: "slope",
        })
        const result = getSortedGrapherTabsForChartHit(grapherState)
        expect(result).toEqual([
            LineChart,
            Table,
            Marimekko,
            WorldMap,
            SlopeChart,
        ])
    })

    it("should always show a chart tab in the first position", () => {
        const grapherState = new GrapherState({
            chartTypes: [StackedArea],
            hasMapTab: true,
        })
        const result = getSortedGrapherTabsForChartHit(grapherState)
        expect(result).toEqual([StackedArea, Table, WorldMap])
    })

    it("should work for stacked chart combinations", () => {
        const grapherState = new GrapherState({
            chartTypes: [StackedArea, StackedBar, StackedDiscreteBar],
        })
        const result = getSortedGrapherTabsForChartHit(grapherState)
        expect(result).toEqual([
            StackedArea,
            Table,
            StackedBar,
            StackedDiscreteBar,
        ])
    })
})

describe(pickDisplayEntities, () => {
    const availableEntityNames = [
        "USA",
        "Canada",
        "Mexico",
        "Brazil",
        "Argentina",
        "World",
    ]

    function createSingleIndicatorGrapherState(
        overrides: GrapherProgrammaticInterface = {}
    ) {
        const table = SynthesizeGDPTable(
            { entityNames: availableEntityNames, timeRange: [2000, 2010] },
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
            { entityNames: availableEntityNames, timeRange: [2000, 2010] },
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

    const defaultEntities = ["USA", "Canada"]
    const pickedEntities = ["Brazil"]

    describe("when entity selection is disabled", async () => {
        it("should return default entities when entity selection is disabled", async () => {
            const grapherState = createSingleIndicatorGrapherState({
                selectedEntityNames: defaultEntities,
                addCountryMode: EntitySelectionMode.Disabled,
            })

            const displayEntities = await pickDisplayEntities(grapherState, {
                pickedEntities,
                catalogUrl: "",
            })

            expect(displayEntities).toEqual(defaultEntities)
        })

        it("should return picked entities for scatter plots and Marimekko charts even when selection is disabled", async () => {
            for (const chartType of [
                GRAPHER_CHART_TYPES.Marimekko,
                GRAPHER_CHART_TYPES.ScatterPlot,
            ]) {
                const grapherState = createSingleIndicatorGrapherState({
                    selectedEntityNames: defaultEntities,
                    addCountryMode: EntitySelectionMode.Disabled,
                    chartTypes: [chartType],
                })

                const displayEntities = await pickDisplayEntities(
                    grapherState,
                    { pickedEntities, catalogUrl: "" }
                )

                pickedEntities.forEach((pickedEntity) =>
                    expect(displayEntities).toContain(pickedEntity)
                )
            }
        })
    })

    describe("when single entity selection is active", () => {
        it("should return only the first picked entity", async () => {
            const grapherState = createSingleIndicatorGrapherState({
                selectedEntityNames: [defaultEntities[0]],
                addCountryMode: EntitySelectionMode.SingleEntity,
            })

            const displayEntities = await pickDisplayEntities(grapherState, {
                pickedEntities,
                catalogUrl: "",
            })

            expect(displayEntities).toEqual([pickedEntities[0]])
        })

        it("should return default entities when no entities are picked", async () => {
            const grapherState = createSingleIndicatorGrapherState({
                selectedEntityNames: [defaultEntities[0]],
                addCountryMode: EntitySelectionMode.SingleEntity,
            })

            const displayEntities = await pickDisplayEntities(grapherState, {
                pickedEntities: [],
                catalogUrl: "",
            })

            expect(displayEntities).toEqual([defaultEntities[0]])
        })
    })

    describe("when multiple entity selection is active", () => {
        it("shouldn't combine default and picked entities when chart is faceted", async () => {
            const grapherState = createMultipleIndicatorsGrapherState({
                selectedEntityNames: defaultEntities,
                addCountryMode: EntitySelectionMode.MultipleEntities,
                selectedFacetStrategy: FacetStrategy.metric,
            })

            const displayEntities = await pickDisplayEntities(grapherState, {
                pickedEntities,
                catalogUrl: "",
            })

            expect(displayEntities).toEqual(pickedEntities)
        })

        it("should un-facet chart when faceted by entity", async () => {
            const grapherState = createMultipleIndicatorsGrapherState({
                selectedEntityNames: defaultEntities,
                addCountryMode: EntitySelectionMode.MultipleEntities,
                selectedFacetStrategy: FacetStrategy.entity,
            })

            const displayEntities = await pickDisplayEntities(grapherState, {
                pickedEntities: [],
                catalogUrl: "",
            })

            expect(displayEntities).toEqual([defaultEntities[0]])
        })

        it("shouldn't combine picked and default entities when using column strategy", async () => {
            const grapherState = createMultipleIndicatorsGrapherState({
                selectedEntityNames: [defaultEntities[0]],
                addCountryMode: EntitySelectionMode.MultipleEntities,
            })

            // Using column strategy
            expect(grapherState.chartState.seriesStrategy).toBe(
                SeriesStrategy.column
            )

            const displayEntities = await pickDisplayEntities(grapherState, {
                pickedEntities,
                catalogUrl: "",
            })

            expect(displayEntities).toEqual(pickedEntities)
        })

        it("should return a unique list of entities, with picked entities first", async () => {
            const grapherState = createSingleIndicatorGrapherState({
                selectedEntityNames: [...defaultEntities, ...pickedEntities],
                addCountryMode: EntitySelectionMode.MultipleEntities,
                peerCountryStrategy: PeerCountryStrategy.ParentRegions,
            })

            const displayEntities = await pickDisplayEntities(grapherState, {
                pickedEntities,
                catalogUrl: "",
            })

            expect(displayEntities).toEqual([...pickedEntities, "World"])
        })
    })
})

describe("bar chart peers for a target with only old data", () => {
    const COUNTRIES = [
        "France",
        "Germany",
        "Italy",
        "Spain",
        "Poland",
        "Norway",
        "Sweden",
        "Finland",
    ]

    /** Italy's last value is in 2010; every other country goes on to 2020 */
    const ITALY_ENDS_EARLY = new OwidTable(
        [
            ["entityName", "year", "value"],
            ...COUNTRIES.map((name, index) => [name, 2010, index * 10]),
            ...COUNTRIES.filter((name) => name !== "Italy").map(
                (name, index) => [name, 2020, index * 15]
            ),
        ],
        [
            { slug: "year", type: ColumnTypeNames.Year },
            { slug: "value", type: ColumnTypeNames.Numeric, tolerance: 5 },
        ]
    )

    const loadPopulation = (async () =>
        COUNTRIES.map((entity, index) => ({
            entity,
            value: (index + 1) * 1_000_000,
        }))) as unknown as AdditionalGrapherDataFetchFn

    const makeGrapherState = (
        overrides: GrapherProgrammaticInterface
    ): GrapherState =>
        new GrapherState({
            table: ITALY_ENDS_EARLY,
            ySlugs: "value",
            addCountryMode: EntitySelectionMode.MultipleEntities,
            peerCountryStrategy: PeerCountryStrategy.DataRange,
            additionalDataLoaderFn: loadPopulation,
            ...overrides,
        })

    async function buildSearchResult(
        grapherState: GrapherState,
        pickedEntities: string[]
    ): Promise<GrapherSearchResultJson | undefined> {
        const sortedTabs = getSortedGrapherTabsForChartHit(grapherState)
        configureGrapherStateTab(grapherState, { tab: sortedTabs[0] })
        const displayEntities = await pickDisplayEntities(grapherState, {
            pickedEntities,
            catalogUrl: "",
        })
        return constructSearchResultJson(grapherState, {
            variant: RichDataVariant.Medium,
            pickedEntities,
            displayEntities,
            sortedTabs,
            numDataTableRowsPerColumn: 4,
        })
    }

    const findBarSlot = (result?: GrapherSearchResultJson) =>
        result?.layout.find(
            (slot) => slot.grapherTab === GRAPHER_TAB_NAMES.DiscreteBar
        )

    it("moves a line chart's bar slot to the target's latest year", async () => {
        const grapherState = makeGrapherState({
            chartTypes: [
                GRAPHER_CHART_TYPES.LineChart,
                GRAPHER_CHART_TYPES.DiscreteBar,
            ],
        })

        const result = await buildSearchResult(grapherState, ["Italy"])

        const barParams = findBarSlot(result)?.previewParams
        expect(barParams?.time).toBe("2010")
        expect(barParams?.focus).toBe("~ITA")
        expect(barParams?.country?.split("~")).toContain("ITA")
        expect(findBarSlot(result)?.chartParams).toEqual(barParams)
    })

    it("moves a bar chart to the target's latest year", async () => {
        const grapherState = makeGrapherState({
            chartTypes: [GRAPHER_CHART_TYPES.DiscreteBar],
        })

        const result = await buildSearchResult(grapherState, ["Italy"])

        expect(result?.grapherQueryParams.time).toBe("2010..2010")
        expect(result?.grapherQueryParams.country?.split("~")).toContain(
            "ITA"
        )
        const plottedEntityNames = grapherState.chartState.series.map(
            (series) => series.seriesName
        )
        expect(plottedEntityNames).toContain("Italy")
        expect(plottedEntityNames.length).toBeGreaterThan(1)
    })

    it("keeps the latest year for a target with recent data", async () => {
        const grapherState = makeGrapherState({
            chartTypes: [
                GRAPHER_CHART_TYPES.LineChart,
                GRAPHER_CHART_TYPES.DiscreteBar,
            ],
        })

        const result = await buildSearchResult(grapherState, ["France"])

        expect(findBarSlot(result)?.previewParams?.time).toBeUndefined()
    })
})

describe(selectRegionGroupByPriority, () => {
    it("prefers OWID continents over income groups", () => {
        const availableEntities = [
            "Italy",
            "Europe",
            "Asia",
            "High-income countries",
            "Low-income countries",
        ]

        const selectedRegions = selectRegionGroupByPriority(availableEntities)

        expect(selectedRegions).toEqual(["Asia", "Europe"])
    })

    it("selects income groups when no continents are available", () => {
        const availableEntities = [
            "High-income countries",
            "Spain",
            "Low-income countries",
            "Africa (WHO)",
            "Upper-middle-income countries",
        ]

        const selectedRegions = selectRegionGroupByPriority(availableEntities)

        expect(selectedRegions).toEqual([
            "High-income countries",
            "Low-income countries",
            "Upper-middle-income countries",
        ])
    })

    it("selects aggregate regions when neither continents nor income groups are available", () => {
        const availableEntities = [
            "Africa (WHO)",
            "United States",
            "Germany",
            "Europe (WHO)",
            "France",
        ]

        const selectedRegions = selectRegionGroupByPriority(availableEntities)

        expect(selectedRegions).toEqual(["Africa (WHO)", "Europe (WHO)"])
    })

    it("selects aggregate regions of a single source", () => {
        const availableEntities = [
            "Africa (WHO)",
            "Africa (WB)",
            "Europe (WHO)",
        ]

        const selectedRegions = selectRegionGroupByPriority(availableEntities)

        expect(selectedRegions).toEqual(["Africa (WHO)", "Europe (WHO)"])
    })

    it("excludes World by default", () => {
        const availableEntities = [WORLD_ENTITY_NAME, "Europe", "Asia"]

        const selectedRegions = selectRegionGroupByPriority(availableEntities)

        expect(selectedRegions).not.toContain(WORLD_ENTITY_NAME)
    })
})
