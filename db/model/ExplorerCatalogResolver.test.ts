import { describe, it, expect } from "vitest"
import { resolveExplorerCatalogPaths } from "./ExplorerCatalogResolver.js"
import { ExplorerProgram } from "@ourworldindata/explorer"

describe("ExplorerCatalogResolver", () => {
    it("should resolve catalog paths in yVariableIds and xVariableId fields", () => {
        const explorerTsv = `explorerTitle\tTest Explorer
graphers
\tgrapherId\tyVariableIds\txVariableId
\t123\tgrapher/gdp/111111#dimension grapher/population/222222#dimension\tgrapher/time/333333#dimension`

        const program = new ExplorerProgram("test-explorer", explorerTsv)

        const catalogPathMap = new Map<string, number | null>([
            ["grapher/gdp/111111#dimension", 5001],
            ["grapher/population/222222#dimension", 5002],
            ["grapher/time/333333#dimension", 6001],
        ])

        const resolvedProgram = resolveExplorerCatalogPaths(
            program,
            catalogPathMap
        )

        const rows = resolvedProgram.decisionMatrix.table.rows
        expect(rows[0].yVariableIds).toBe("5001 5002")
        expect(rows[0].xVariableId).toBe("6001")
    })

    it("should resolve catalog paths in sortColumnSlug field", () => {
        const explorerTsv = `explorerTitle\tTest Explorer
graphers
\tgrapherId\tMetric Radio\tsortBy\tsortColumnSlug\tySlugs
\t123\tGDP\tcolumn\tgrapher/gdp/123456#dimension\tgdp
\t456\tPopulation\tcolumn\tgrapher/population/789012#dimension\tpopulation`

        const program = new ExplorerProgram("test-explorer", explorerTsv)

        // Catalog path to ID mapping
        const catalogPathMap = new Map<string, number | null>([
            ["grapher/gdp/123456#dimension", 999],
            ["grapher/population/789012#dimension", 888],
        ])

        const resolvedProgram = resolveExplorerCatalogPaths(
            program,
            catalogPathMap
        )

        // Check that catalog paths were resolved to indicator IDs
        const decisionMatrix = resolvedProgram.decisionMatrix
        const rows = decisionMatrix.table.rows

        expect(rows[0].sortColumnSlug).toBe("999")
        expect(rows[1].sortColumnSlug).toBe("888")
    })

    it("should handle unresolved catalog paths gracefully", () => {
        const explorerTsv = `explorerTitle\tTest Explorer
graphers
\tgrapherId\tMetric Radio\tsortBy\tsortColumnSlug\tySlugs
\t123\tGDP\tcolumn\tgrapher/unknown/999999#dimension\tgdp`

        const program = new ExplorerProgram("test-explorer", explorerTsv)

        // Catalog path map with null value indicates unresolved path
        const catalogPathMap = new Map<string, number | null>([
            ["grapher/unknown/999999#dimension", null],
        ])

        const resolvedProgram = resolveExplorerCatalogPaths(
            program,
            catalogPathMap
        )
        // Unresolved paths should remain as-is
        const decisionMatrix = resolvedProgram.decisionMatrix
        const rows = decisionMatrix.table.rows

        expect(rows[0].sortColumnSlug).toBe("grapher/unknown/999999#dimension")
    })
})
