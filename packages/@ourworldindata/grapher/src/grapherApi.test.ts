import { afterEach, describe, expect, it, vi } from "vitest"
import { OwidTable } from "@ourworldindata/core-table"
import {
    ColumnTypeNames,
    DimensionProperty,
    type GrapherInterface,
    type OwidColumnDef,
} from "@ourworldindata/types"
import { GrapherLoader } from "./grapherApi.js"

const csv = `entityName,year,vacancy_rate
Berlin,2020,1.2
Vienna,2020,3.8`

const columnDefs: OwidColumnDef[] = [
    {
        slug: "vacancy_rate",
        type: ColumnTypeNames.Numeric,
        name: "Vacancy rate",
        unit: "%",
    },
]

const config: GrapherInterface = {
    dimensions: [
        {
            property: DimensionProperty.y,
            slug: "vacancy_rate",
            display: { name: "Empty homes", conversionFactor: 10 },
        },
    ],
}

describe("GrapherLoader with a slot naming a host column", () => {
    afterEach(() => {
        vi.restoreAllMocks()
    })

    it("applies the slot's display to an inline CSV", () => {
        const { grapherState } = GrapherLoader.fromCsv({
            config,
            csv,
            columnDefs,
        })

        const [yColumn] = grapherState.yColumnsFromDimensionsOrSlugsOrAuto
        expect(yColumn.slug).toBe("vacancy_rate")
        expect(yColumn.displayName).toBe("Empty homes")
        expect(yColumn.unit).toBe("%")
        expect(yColumn.values).toEqual([12, 38])
    })

    it("applies the slot's display to a CSV fetched from a URL", async () => {
        vi.spyOn(OwidTable, "fromUrl").mockResolvedValue(
            new OwidTable(csv, columnDefs)
        )
        const loader = GrapherLoader.fromCsv({
            config,
            csvUrl: "https://example.com/data.csv",
            columnDefs,
        })
        await loader.ready

        const [yColumn] =
            loader.grapherState.yColumnsFromDimensionsOrSlugsOrAuto
        expect(yColumn.displayName).toBe("Empty homes")
        expect(yColumn.values).toEqual([12, 38])
    })
})

describe("GrapherLoader canonicalUrl", () => {
    const publishedConfig: GrapherInterface = {
        ...config,
        slug: "vacancy-rates",
        isPublished: true,
    }

    it("derives the chart page from the slug by default", () => {
        const { grapherState } = GrapherLoader.fromCsv({
            config: publishedConfig,
            csv,
            columnDefs,
        })
        expect(grapherState.canonicalUrl).toBe("/grapher/vacancy-rates")
    })

    it("has no chart page to link to when canonicalUrl is null", () => {
        const { grapherState } = GrapherLoader.fromCsv({
            config: { ...publishedConfig, canonicalUrl: null },
            csv,
            columnDefs,
        })
        expect(grapherState.canonicalUrl).toBeUndefined()
        expect(grapherState.embedUrl).toBeUndefined()
    })

    it("follows canonicalUrl through later config updates", () => {
        const { grapherState } = GrapherLoader.fromCsv({
            config: { ...publishedConfig, canonicalUrl: null },
            csv,
            columnDefs,
        })

        grapherState.updateFromObject(publishedConfig)
        expect(grapherState.canonicalUrl).toBe("/grapher/vacancy-rates")

        grapherState.updateFromObject({
            ...publishedConfig,
            canonicalUrl: "https://example.org/vacancies",
        })
        expect(grapherState.canonicalUrl).toBe("https://example.org/vacancies")
    })
})

describe("GrapherLoader with selectedEntityColors", () => {
    const colorConfig: GrapherInterface = {
        ...config,
        selectedEntityNames: ["Berlin", "Vienna"],
        selectedEntityColors: { Berlin: "#3360a9", Vienna: "#ed6c2d" },
    }

    const seriesColors = (
        loader: GrapherLoader
    ): Record<string, string | undefined> =>
        Object.fromEntries(
            loader.grapherState.chartState.series.map((series) => [
                series.seriesName,
                series.color,
            ])
        )

    it("colors entities from an inline CSV", () => {
        const loader = GrapherLoader.fromCsv({
            config: colorConfig,
            csv,
            columnDefs,
        })
        expect(seriesColors(loader)).toEqual({
            Berlin: "#3360a9",
            Vienna: "#ed6c2d",
        })
    })

    it("keeps an entity color column the table already has", () => {
        const loader = GrapherLoader.fromTable({
            config: colorConfig,
            data: new OwidTable(
                `entityName,year,vacancy_rate,entityColor
Berlin,2020,1.2,#111111
Vienna,2020,3.8,#222222`,
                [
                    ...columnDefs,
                    { slug: "entityColor", type: ColumnTypeNames.Color },
                ]
            ),
        })
        expect(seriesColors(loader)).toEqual({
            Berlin: "#111111",
            Vienna: "#222222",
        })
    })
})

describe("GrapherLoader with a versioned config", () => {
    it("migrates an outdated config to the latest schema version", () => {
        const { grapherState } = GrapherLoader.fromCsv({
            config: {
                ...config,
                $schema:
                    "https://files.ourworldindata.org/schemas/grapher-schema.005.json",
                // v6 replaced `type` with `chartTypes`
                type: "SlopeChart",
            } as GrapherInterface,
            csv,
            columnDefs,
        })

        expect(grapherState.chartTypes).toEqual(["SlopeChart"])
    })
})
