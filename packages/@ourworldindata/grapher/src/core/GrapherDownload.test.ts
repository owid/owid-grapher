import { describe, expect, it } from "vitest"
import {
    GRAPHER_CHART_TYPES,
    GRAPHER_TAB_CONFIG_OPTIONS,
} from "@ourworldindata/types"
import { ColumnTypeNames } from "@ourworldindata/utils"
import { ErrorValueTypes, OwidTable } from "@ourworldindata/core-table"
import { GrapherState } from "./GrapherState"

// Downloads must preserve the chart's data and its provenance in a usable table.
// Keep tab-specific paths separate from column selection and time bookkeeping.
describe("prepareTableForDownload", () => {
    // Downloads include the data roles and annotations used by the chart.
    describe("columns and annotations", () => {
        it("includes x, y, entity, code, and time columns for line charts", () => {
            const table = new OwidTable([
                ["entityName", "entityCode", "year", "gdp", "population"],
                ["France", "FRA", 2020, 2500, 67000000],
                ["France", "FRA", 2021, 2600, 67500000],
                ["Germany", "DEU", 2020, 3500, 83000000],
            ])

            const grapher = new GrapherState({
                table,
                chartTypes: [GRAPHER_CHART_TYPES.LineChart],
                ySlugs: "gdp population",
                selectedEntityNames: ["France", "Germany"],
            })

            const downloadTable = grapher.filteredTableForDownload
            const columns = downloadTable.columnSlugs

            expect(columns).toContain("entityName")
            expect(columns).toContain("entityCode")
            expect(columns).toContain("year")
            expect(columns).toContain("gdp")
            expect(columns).toContain("population")
            expect(downloadTable.numRows).toBe(3)
        })

        it("includes x, y, color, and size columns for scatter plots", () => {
            const table = new OwidTable([
                [
                    "entityName",
                    "entityCode",
                    "year",
                    "gdp",
                    "lifeExpectancy",
                    "continent",
                    "population",
                ],
                ["France", "FRA", 2020, 2500, 82, "Europe", 67000000],
                ["Kenya", "KEN", 2020, 100, 66, "Africa", 53000000],
            ])

            const grapher = new GrapherState({
                table,
                chartTypes: [GRAPHER_CHART_TYPES.ScatterPlot],
                xSlug: "gdp",
                ySlugs: "lifeExpectancy",
                colorSlug: "continent",
                sizeSlug: "population",
            })

            const downloadTable = grapher.filteredTableForDownload
            const columns = downloadTable.columnSlugs

            expect(columns).toContain("entityName")
            expect(columns).toContain("entityCode")
            expect(columns).toContain("year")
            expect(columns).toContain("gdp")
            expect(columns).toContain("lifeExpectancy")
            expect(columns).toContain("continent")
            expect(columns).toContain("population")
        })

        it("includes annotation columns when present", () => {
            const table = new OwidTable([
                ["entityName", "entityCode", "year", "gdp", "gdp-annotations"],
                ["France", "FRA", 2020, 2500, "preliminary"],
                ["France", "FRA", 2021, 2600, ""],
            ])

            const grapher = new GrapherState({
                table,
                chartTypes: [GRAPHER_CHART_TYPES.LineChart],
                ySlugs: "gdp",
                selectedEntityNames: ["France"],
            })

            const downloadTable = grapher.filteredTableForDownload
            const columns = downloadTable.columnSlugs

            expect(columns).toContain("gdp-annotations")
        })
    })

    // Missing data must not produce empty observations; available entity codes survive.
    describe("row eligibility and entity codes", () => {
        it("drops rows without any x or y values", () => {
            const table = new OwidTable([
                ["entityName", "entityCode", "year", "gdp", "population"],
                ["France", "FRA", 2020, 2500, 67000000],
                ["France", "FRA", 2021, null, null],
                ["France", "FRA", 2022, 2700, null],
            ])

            const grapher = new GrapherState({
                table,
                chartTypes: [GRAPHER_CHART_TYPES.LineChart],
                ySlugs: "gdp population",
                selectedEntityNames: ["France"],
            })

            const downloadTable = grapher.filteredTableForDownload
            expect(
                downloadTable.rows.map(({ year, gdp }) => [year, gdp])
            ).toEqual([
                [2020, 2500],
                [2022, 2700],
            ])
        })

        it("attempts to fill in missing entity codes from inputTable", () => {
            // Create a table where entity codes may be missing or present
            const table = new OwidTable([
                ["entityName", "entityCode", "entityId", "year", "gdp"],
                ["France", "FRA", 1, 2020, 2500],
                ["United Kingdom", "GBR", 2, 2020, 3500],
                ["United Kingdom", undefined, 2, 2021, 3600], // Missing code in one row
            ])

            const grapher = new GrapherState({
                table,
                chartTypes: [GRAPHER_CHART_TYPES.LineChart],
                ySlugs: "gdp",
                selectedEntityNames: ["France", "United Kingdom"],
            })

            const downloadTable = grapher.filteredTableForDownload
            const ukRows = downloadTable.rows.filter(
                (r) => r.entityName === "United Kingdom"
            )

            // Preserve both observations, including the row that needed a code.
            expect(
                ukRows.map(({ year, entityCode }) => [year, entityCode])
            ).toEqual([
                [2020, "GBR"],
                [2021, "GBR"],
            ])
        })

        it("handles empty tables gracefully", () => {
            const table = new OwidTable([
                ["entityName", "entityCode", "year", "gdp"],
            ])

            const grapher = new GrapherState({
                table,
                chartTypes: [GRAPHER_CHART_TYPES.LineChart],
                ySlugs: "gdp",
                selectedEntityNames: [],
            })

            expect(() => grapher.filteredTableForDownload).not.toThrow()
            const downloadTable = grapher.filteredTableForDownload
            expect(downloadTable.numRows).toBe(0)
            // Empty tables have no columns when filtered
            expect(downloadTable.columnSlugs.length).toBe(0)
        })

        it("handles error values in download data", () => {
            const table = new OwidTable(
                [
                    ["entityName", "entityCode", "year", "gdp"],
                    ["France", "FRA", 2019, 2500],
                    ["France", "FRA", 2020, null],
                    ["France", "FRA", 2021, 2600],
                ],
                [
                    {
                        slug: "gdp",
                        type: ColumnTypeNames.Numeric,
                        tolerance: 1,
                    },
                ]
            ).interpolateColumnWithTolerance("gdp")

            const grapher = new GrapherState({
                table,
                chartTypes: [GRAPHER_CHART_TYPES.LineChart],
                ySlugs: "gdp",
                selectedEntityNames: ["France"],
            })

            const downloadTable = grapher.filteredTableForDownload

            // Should include rows with valid values
            expect(downloadTable.numRows).toBeGreaterThan(0)

            // 2020 borrows the equally close later observation (2021). Only
            // that row needs a source year; error placeholders serialize blank.
            expect(downloadTable.toCsv()).toBe(
                "entityName,entityCode,year,gdp,gdp-originalTime\n" +
                    "France,FRA,2019,2500,\n" +
                    "France,FRA,2020,2600,2021\n" +
                    "France,FRA,2021,2600,"
            )
        })
    })

    // Borrowed observations need their source time; redundant source times stay blank.
    describe("original observation times", () => {
        it("keeps observed years without source-time columns when no interpolation was applied", () => {
            const table = new OwidTable(
                [
                    ["entityName", "entityCode", "year", "gdp"],
                    ["France", "FRA", 2019, 2500],
                    ["France", "FRA", 2020, null],
                    ["France", "FRA", 2021, 2600],
                ],
                [
                    {
                        slug: "gdp",
                        type: ColumnTypeNames.Numeric,
                        tolerance: 1,
                    },
                ]
            )

            const grapher = new GrapherState({
                table,
                chartTypes: [GRAPHER_CHART_TYPES.LineChart],
                ySlugs: "gdp",
                selectedEntityNames: ["France"],
            })

            const downloadTable = grapher.filteredTableForDownload

            // A tolerance setting alone does not interpolate this line table.
            // The missing 2020 observation drops out; no source-time column exists.
            expect(downloadTable.has("gdp-originalTime")).toBe(false)

            expect(downloadTable.has("year")).toBe(true)
            const years = downloadTable.get("year").values
            expect(years).toEqual([2019, 2021])
        })

        it("keeps original time columns separate when there are multiple y columns", () => {
            // Create a table with multiple y columns and tolerance applied
            let table = new OwidTable(
                [
                    ["entityName", "entityCode", "year", "gdp", "population"],
                    ["France", "FRA", 2019, 2500, null],
                    ["France", "FRA", 2020, null, 67000000],
                    ["France", "FRA", 2021, 2600, null],
                ],
                [
                    {
                        slug: "gdp",
                        type: ColumnTypeNames.Numeric,
                        tolerance: 1,
                    },
                    {
                        slug: "population",
                        type: ColumnTypeNames.Numeric,
                        tolerance: 1,
                    },
                ]
            )

            // Manually apply tolerance to both columns
            table = table.interpolateColumnWithTolerance("gdp")
            table = table.interpolateColumnWithTolerance("population")

            const grapher = new GrapherState({
                table,
                chartTypes: [GRAPHER_CHART_TYPES.LineChart],
                ySlugs: "gdp population",
                selectedEntityNames: ["France"],
            })

            const downloadTable = grapher.filteredTableForDownload

            // With multiple y columns, original time columns should be kept separate
            expect(downloadTable.has("gdp-originalTime")).toBe(true)
            expect(downloadTable.has("population-originalTime")).toBe(true)
            expect(downloadTable.has("year")).toBe(true)
        })

        it("drops original time columns that are completely empty", () => {
            const table = new OwidTable([
                ["entityName", "entityCode", "year", "gdp", "population"],
                ["France", "FRA", 2020, 2500, 67000000],
                ["France", "FRA", 2021, 2600, 67500000],
            ])

            const grapher = new GrapherState({
                table,
                chartTypes: [GRAPHER_CHART_TYPES.LineChart],
                ySlugs: "gdp population",
                selectedEntityNames: ["France"],
            })

            const downloadTable = grapher.filteredTableForDownload

            // No tolerance applied, so no original time columns should be present
            expect(downloadTable.has("gdp-originalTime")).toBe(false)
            expect(downloadTable.has("population-originalTime")).toBe(false)
        })

        it("replaces duplicate times with missing value placeholders in original time columns", () => {
            const inputTable = new OwidTable(
                [
                    ["entityName", "entityCode", "year", "gdp"],
                    ["France", "FRA", 2019, 2500],
                    ["France", "FRA", 2020, null],
                    ["France", "FRA", 2021, 2600],
                ],
                [
                    {
                        slug: "gdp",
                        type: ColumnTypeNames.Numeric,
                        tolerance: 1,
                    },
                ]
            )

            // Apply tolerance
            const table = inputTable.interpolateColumnWithTolerance("gdp")

            const grapher = new GrapherState({
                table,
                chartTypes: [GRAPHER_CHART_TYPES.LineChart],
                ySlugs: "gdp",
                selectedEntityNames: ["France"],
            })

            const downloadTable = grapher.filteredTableForDownload

            const originalTimes =
                downloadTable.get("gdp-originalTime").valuesIncludingErrorValues

            // Only 2020 borrows data: its equally close later source is 2021.
            expect(originalTimes).toEqual([
                ErrorValueTypes.MissingValuePlaceholder,
                2021,
                ErrorValueTypes.MissingValuePlaceholder,
            ])
        })
    })

    // Each tab supplies its own table/time selection; keep these distinct paths covered.
    describe("chart and tab boundaries", () => {
        it("handles discrete bar charts correctly", () => {
            const table = new OwidTable([
                ["entityName", "entityCode", "year", "gdp"],
                ["France", "FRA", 2020, 2500],
                ["Germany", "DEU", 2020, 3500],
                ["Italy", "ITA", 2020, 2000],
            ])

            const grapher = new GrapherState({
                table,
                chartTypes: [GRAPHER_CHART_TYPES.DiscreteBar],
                ySlugs: "gdp",
                selectedEntityNames: ["France", "Germany", "Italy"],
                maxTime: 2020,
            })

            const downloadTable = grapher.filteredTableForDownload
            expect(downloadTable.numRows).toBe(3)
            expect(downloadTable.get("year").uniqValues).toEqual([2020])
        })

        it("handles slope charts correctly", () => {
            const table = new OwidTable([
                ["entityName", "entityCode", "year", "gdp"],
                ["France", "FRA", 2010, 2000],
                ["France", "FRA", 2015, 2300],
                ["France", "FRA", 2020, 2500],
                ["Germany", "DEU", 2010, 3000],
                ["Germany", "DEU", 2015, 3300],
                ["Germany", "DEU", 2020, 3500],
            ])

            const grapher = new GrapherState({
                table,
                chartTypes: [GRAPHER_CHART_TYPES.SlopeChart],
                ySlugs: "gdp",
                selectedEntityNames: ["France", "Germany"],
                minTime: 2010,
                maxTime: 2020,
            })

            const downloadTable = grapher.filteredTableForDownload
            // Slope charts only show start and end times
            expect(downloadTable.numRows).toBe(4) // 2 entities × 2 times
            expect(downloadTable.get("year").uniqValues).toEqual([2010, 2020])
        })

        it("handles table data correctly", () => {
            const table = new OwidTable([
                ["entityName", "entityCode", "year", "gdp", "population"],
                ["France", "FRA", 2020, 2500, 67000000],
                ["Germany", "DEU", 2020, 3500, 83000000],
            ])

            const grapher = new GrapherState({
                table,
                tab: GRAPHER_TAB_CONFIG_OPTIONS.table,
                ySlugs: "gdp population",
            })

            const downloadTable = grapher.tableForDownload
            expect(downloadTable.numRows).toBe(2)
            expect(downloadTable.columnSlugs).toContain("gdp")
            expect(downloadTable.columnSlugs).toContain("population")
        })

        it("handles map tab downloads correctly", () => {
            const table = new OwidTable([
                ["entityName", "entityCode", "year", "gdp"],
                ["France", "FRA", 2020, 2500],
                ["Germany", "DEU", 2020, 3500],
                ["France", "FRA", 2021, 2600],
                ["Germany", "DEU", 2021, 3700],
            ])

            const grapher = new GrapherState({
                table,
                hasMapTab: true,
                tab: GRAPHER_TAB_CONFIG_OPTIONS.map,
                ySlugs: "gdp",
                map: { time: 2020 },
            })

            const downloadTable = grapher.filteredTableForDownload

            // Map downloads should include the selected time
            expect(downloadTable.numRows).toBeGreaterThan(0)
            expect(downloadTable.columnSlugs).toContain("entityName")
            expect(downloadTable.columnSlugs).toContain("entityCode")
            expect(downloadTable.columnSlugs).toContain("year")
            expect(downloadTable.columnSlugs).toContain("gdp")

            // Should only include data for the selected year (2020)
            const years = downloadTable.get("year").uniqValues
            expect(years).toEqual([2020])
        })
    })
})
