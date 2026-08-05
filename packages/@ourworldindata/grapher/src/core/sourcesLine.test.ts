import { expect, it } from "vitest"
import { BlankOwidTable, OwidTable } from "@ourworldindata/core-table"
import { GRAPHER_TAB_NAMES } from "@ourworldindata/types"
import { ColumnTypeNames } from "@ourworldindata/utils"
import { pickColumnsForSourcesLine } from "./sourcesLine.js"

const table = new OwidTable(
    `entityName,year,gdp,trade,hdi,energy,continent,pop
Iceland,2000,100,20,0.9,50,Europe,300000`,
    [
        { slug: "gdp", type: ColumnTypeNames.Numeric },
        { slug: "trade", type: ColumnTypeNames.Numeric },
        { slug: "hdi", type: ColumnTypeNames.Numeric },
        { slug: "energy", type: ColumnTypeNames.Numeric },
        { slug: "continent", type: ColumnTypeNames.Continent },
        {
            slug: "pop",
            type: ColumnTypeNames.Numeric,
            catalogPath:
                "grapher/demography/2024-07-15/population/population#population",
        },
        { slug: "year", type: ColumnTypeNames.Year },
    ]
)

it("attributes only the map column on the map tab", () => {
    const columnSlugs = pickColumnsForSourcesLine({
        table: BlankOwidTable(),
        yColumnSlugs: ["y1", "y2"],
        mapColumnSlugs: ["map"],
        activeTab: GRAPHER_TAB_NAMES.WorldMap,
    })
    expect(columnSlugs).toEqual(["map"])
})

it("attributes both map columns if the map combines projected and historical data", () => {
    const columnSlugs = pickColumnsForSourcesLine({
        table: BlankOwidTable(),
        yColumnSlugs: ["projected", "historical"],
        mapColumnSlugs: ["projected", "historical"],
        activeTab: GRAPHER_TAB_NAMES.WorldMap,
    })
    expect(columnSlugs).toEqual(["projected", "historical"])
})

it("falls back to the y column on the map tab if no map column is given", () => {
    const columnSlugs = pickColumnsForSourcesLine({
        table: BlankOwidTable(),
        yColumnSlugs: ["y1"],
        activeTab: GRAPHER_TAB_NAMES.WorldMap,
    })
    expect(columnSlugs).toEqual(["y1"])
})

it("attributes all y columns on chart tabs", () => {
    const columnSlugs = pickColumnsForSourcesLine({
        table: BlankOwidTable(),
        yColumnSlugs: ["y1", "y2"],
        mapColumnSlugs: ["map"],
        activeTab: GRAPHER_TAB_NAMES.LineChart,
    })
    expect(columnSlugs).toEqual(["y1", "y2"])
})

it("attributes the y, color, x and size columns on the scatter tab", () => {
    const columnSlugs = pickColumnsForSourcesLine({
        table,
        yColumnSlugs: ["gdp"],
        xColumnSlug: "trade",
        colorColumnSlug: "hdi",
        sizeColumnSlug: "energy",
        activeTab: GRAPHER_TAB_NAMES.ScatterPlot,
    })
    expect(columnSlugs).toEqual(["gdp", "hdi", "trade", "energy"])
})

it("ignores dimensions the active chart type doesn't plot", () => {
    const columnSlugs = pickColumnsForSourcesLine({
        table,
        yColumnSlugs: ["gdp"],
        xColumnSlug: "trade",
        colorColumnSlug: "hdi",
        sizeColumnSlug: "energy",
        activeTab: GRAPHER_TAB_NAMES.LineChart,
    })
    expect(columnSlugs).toEqual(["gdp", "hdi"])
})

it("attributes all dimensions when no active tab is given", () => {
    const columnSlugs = pickColumnsForSourcesLine({
        table,
        yColumnSlugs: ["gdp"],
        xColumnSlug: "trade",
        colorColumnSlug: "hdi",
        sizeColumnSlug: "energy",
    })
    expect(columnSlugs).toEqual(["gdp", "hdi", "trade", "energy"])
})

it("excludes a continents color column", () => {
    const columnSlugs = pickColumnsForSourcesLine({
        table,
        yColumnSlugs: ["gdp"],
        colorColumnSlug: "continent",
        activeTab: GRAPHER_TAB_NAMES.ScatterPlot,
    })
    expect(columnSlugs).toEqual(["gdp"])
})

it("excludes a population size column", () => {
    const columnSlugs = pickColumnsForSourcesLine({
        table,
        yColumnSlugs: ["gdp"],
        sizeColumnSlug: "pop",
        activeTab: GRAPHER_TAB_NAMES.ScatterPlot,
    })
    expect(columnSlugs).toEqual(["gdp"])
})

it("excludes a population x column on the marimekko tab, but not on the scatter tab", () => {
    const marimekkoSlugs = pickColumnsForSourcesLine({
        table,
        yColumnSlugs: ["gdp"],
        xColumnSlug: "pop",
        activeTab: GRAPHER_TAB_NAMES.Marimekko,
    })
    expect(marimekkoSlugs).toEqual(["gdp"])

    const scatterSlugs = pickColumnsForSourcesLine({
        table,
        yColumnSlugs: ["gdp"],
        xColumnSlug: "pop",
        activeTab: GRAPHER_TAB_NAMES.ScatterPlot,
    })
    expect(scatterSlugs).toEqual(["gdp", "pop"])
})

it("deduplicates repeated columns", () => {
    const columnSlugs = pickColumnsForSourcesLine({
        table,
        yColumnSlugs: ["gdp"],
        colorColumnSlug: "gdp",
        activeTab: GRAPHER_TAB_NAMES.LineChart,
    })
    expect(columnSlugs).toEqual(["gdp"])
})
