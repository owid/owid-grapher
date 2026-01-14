import { describe, expect, it } from "vitest"
import { parseCatalogPaths } from "./shared.js"

describe("parseCatalogPaths", () => {
    it("parses valid catalog paths", () => {
        const paths = [
            "grapher/who/2024-08-06/ghe/mortality#deaths",
            "grapher/faostat/2024-03-14/faostat_tcl/faostat_tcl_flat#sugar",
        ]
        const result = parseCatalogPaths(paths)
        expect(result).toEqual({
            datasetNamespaces: ["who", "faostat"],
            datasetVersions: ["2024-08-06", "2024-03-14"],
            datasetProducts: ["ghe", "faostat_tcl"],
        })
    })

    it("deduplicates values from multiple paths with same dimensions", () => {
        const paths = [
            "grapher/who/2024-08-06/ghe/mortality#deaths",
            "grapher/who/2024-08-06/ghe/other#rate",
        ]
        const result = parseCatalogPaths(paths)
        expect(result).toEqual({
            datasetNamespaces: ["who"],
            datasetVersions: ["2024-08-06"],
            datasetProducts: ["ghe"],
        })
    })

    // Real scenario: some variables have NULL catalogPath in the database
    // JSON_ARRAYAGG produces arrays like: [null, null, "grapher/...", "grapher/..."]
    it("filters out null values in mixed array", () => {
        const paths = [
            null,
            null,
            "grapher/demography/2024-07-15/population/historical#population",
            "grapher/regions/2023-01-01/regions/regions#owid_region",
        ]
        const result = parseCatalogPaths(paths)
        expect(result).toEqual({
            datasetNamespaces: ["demography", "regions"],
            datasetVersions: ["2024-07-15", "2023-01-01"],
            datasetProducts: ["population", "regions"],
        })
    })

    // Real scenario: all variables for a chart have NULL catalogPath
    // JSON_ARRAYAGG produces: [null] or [null, null]
    it("returns empty arrays when all paths are null", () => {
        const paths = [null]
        const result = parseCatalogPaths(paths)
        expect(result).toEqual({
            datasetNamespaces: [],
            datasetVersions: [],
            datasetProducts: [],
        })
    })

    it("returns empty arrays for empty input", () => {
        const result = parseCatalogPaths([])
        expect(result).toEqual({
            datasetNamespaces: [],
            datasetVersions: [],
            datasetProducts: [],
        })
    })

    it("handles undefined values", () => {
        const paths = [undefined, "grapher/who/2024-08-06/ghe/mortality#deaths"]
        const result = parseCatalogPaths(paths)
        expect(result).toEqual({
            datasetNamespaces: ["who"],
            datasetVersions: ["2024-08-06"],
            datasetProducts: ["ghe"],
        })
    })

    it("skips malformed paths with fewer than 4 segments", () => {
        const paths = [
            "grapher/who", // too short
            "grapher/who/2024-08-06/ghe/mortality#deaths", // valid
        ]
        const result = parseCatalogPaths(paths)
        expect(result).toEqual({
            datasetNamespaces: ["who"],
            datasetVersions: ["2024-08-06"],
            datasetProducts: ["ghe"],
        })
    })
})
