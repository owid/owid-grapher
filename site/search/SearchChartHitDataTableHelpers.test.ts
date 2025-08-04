import { describe, it, expect } from "vitest"
import { GrapherState } from "@ourworldindata/grapher"
import {
    FacetStrategy,
    DimensionProperty,
    EntitySelectionMode,
} from "@ourworldindata/types"
import {
    SynthesizeGDPTable,
    SampleColumnSlugs,
    SynthesizeFruitTable,
} from "@ourworldindata/core-table"
import { buildChartHitDataTableProps } from "./SearchChartHitDataTableHelpers"

describe("buildChartHitDataTableProps for LineChart", () => {
    it("lists entities when entities are plotted", () => {
        const table = SynthesizeGDPTable(
            { entityCount: 5, timeRange: [2000, 2010] },
            12 // seed
        )
        const grapherState = new GrapherState({
            table,
            selectedEntityNames: table.sampleEntityName(3),
            dimensions: [
                {
                    slug: SampleColumnSlugs.GDP,
                    property: DimensionProperty.y,
                    variableId: SampleColumnSlugs.GDP as any,
                },
            ],
        })

        const dataTable = buildChartHitDataTableProps({ grapherState })

        expect(dataTable?.title).toBe("GDP")
        expect(dataTable?.rows).toMatchObject([
            { name: "Philippines", time: "2009", value: "$682.03 billion" },
            { name: "Benin", time: "2009", value: "$233.42 billion" },
            { name: "Eritrea", time: "2009", value: "$63.2 billion" },
        ])

        // Check that the colors are unique
        const colors = dataTable?.rows.map((row) => row.color)
        expect(new Set(colors)).toHaveLength(colors!.length)
    })

    it("lists columns when columns are plotted", () => {
        const table = SynthesizeFruitTable(
            { entityCount: 5, timeRange: [2000, 2010] },
            12 // seed
        )
        const grapherState = new GrapherState({
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
        })

        const dataTable = buildChartHitDataTableProps({ grapherState })

        expect(dataTable?.title).toBe("Benin")
        expect(dataTable?.rows).toMatchObject([
            { name: "Fruit", time: "2009", value: "573" },
            { name: "Vegetables", time: "2009", value: "542" },
        ])

        // Check that the colors are unique
        const colors = dataTable?.rows.map((row) => row.color)
        expect(new Set(colors)).toHaveLength(colors!.length)
    })

    it("highlights focused entities", () => {
        const table = SynthesizeGDPTable(
            { entityCount: 5, timeRange: [2000, 2010] },
            12 // seed
        )
        const selectedEntityNames = table.sampleEntityName(3)
        const grapherState = new GrapherState({
            table,
            selectedEntityNames,
            dimensions: [
                {
                    slug: SampleColumnSlugs.GDP,
                    property: DimensionProperty.y,
                    variableId: SampleColumnSlugs.GDP as any,
                },
            ],
            focusedSeriesNames: [selectedEntityNames[0]],
        })

        const dataTable = buildChartHitDataTableProps({ grapherState })

        expect(dataTable?.title).toBe("GDP")
        expect(dataTable?.rows).toMatchObject([
            { name: "Philippines", muted: true },
            { name: "Benin", muted: false },
            { name: "Eritrea", muted: true },
        ])
    })

    it("lists all entities in facets when each facet plots a single entity", () => {
        const table = SynthesizeGDPTable(
            { entityCount: 5, timeRange: [2000, 2010] },
            12 // seed
        )
        const grapherState = new GrapherState({
            table,
            selectedEntityNames: table.sampleEntityName(4),
            dimensions: [
                {
                    slug: SampleColumnSlugs.GDP,
                    property: DimensionProperty.y,
                    variableId: SampleColumnSlugs.GDP as any,
                },
            ],
            selectedFacetStrategy: FacetStrategy.entity,
        })

        const dataTable = buildChartHitDataTableProps({ grapherState })

        expect(dataTable?.title).toBe("GDP")
        expect(dataTable?.rows).toMatchObject([
            { name: "Philippines", time: "2009", value: "$682.03 billion" },
            { name: "Macao", time: "2009", value: "$623.22 billion" },
            { name: "Benin", time: "2009", value: "$233.42 billion" },
            { name: "Eritrea", time: "2009", value: "$63.2 billion" },
        ])
    })

    it("lists entities of the first facet when each facet plots multiple entities", () => {
        const table = SynthesizeGDPTable(
            { entityCount: 5, timeRange: [2000, 2010] },
            12 // seed
        )
        const grapherState = new GrapherState({
            table,
            selectedEntityNames: table.sampleEntityName(4),
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
            selectedFacetStrategy: FacetStrategy.metric,
        })

        const dataTable = buildChartHitDataTableProps({ grapherState })

        expect(dataTable?.title).toBe("GDP")
        expect(dataTable?.rows).toMatchObject([
            { name: "Philippines", time: "2009", value: "$682.03 billion" },
            { name: "Macao", time: "2009", value: "$623.22 billion" },
            { name: "Benin", time: "2009", value: "$233.42 billion" },
            { name: "Eritrea", time: "2009", value: "$63.2 billion" },
        ])

        // Check that the colors are unique
        const colors = dataTable?.rows.map((row) => row.color)
        expect(new Set(colors)).toHaveLength(colors!.length)
    })
})
