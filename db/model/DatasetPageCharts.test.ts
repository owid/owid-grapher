import { describe, expect, it } from "vitest"

import { catalogPathMatches, parseCatalogPath } from "./DatasetPageCharts.js"

// A dataset page finds the charts that use its indicators by comparing catalog
// paths part by part. These tests pin down the path format and the matching
// rule: every part must be equal, except the version when the pattern has "*".
// The column may also be the one an indicator with dimensions was made from.

describe(parseCatalogPath, () => {
    it("splits a path into its six parts", () => {
        expect(
            parseCatalogPath(
                "grapher/energy/2026-06-30/energy_mix/energy_mix#coal_twh"
            )
        ).toEqual({
            channel: "grapher",
            namespace: "energy",
            version: "2026-06-30",
            dataset: "energy_mix",
            table: "energy_mix",
            column: "coal_twh",
        })
    })

    it("keeps a * version as it is", () => {
        expect(
            parseCatalogPath("grapher/energy/*/energy_mix/energy_mix#coal_twh")
                ?.version
        ).toEqual("*")
    })

    it.each([
        ["no column", "grapher/energy/2026-06-30/energy_mix/energy_mix"],
        ["an empty column", "grapher/energy/2026-06-30/energy_mix/energy_mix#"],
        [
            "two columns",
            "grapher/energy/2026-06-30/energy_mix/energy_mix#coal_twh#gas_twh",
        ],
        ["no channel", "energy/2026-06-30/energy_mix/energy_mix#coal_twh"],
        [
            "an extra segment",
            "grapher/energy/2026-06-30/energy_mix/energy_mix/extra#coal_twh",
        ],
        ["an empty segment", "grapher/energy//energy_mix/energy_mix#coal_twh"],
    ])("rejects a path with %s", (_, path) => {
        expect(parseCatalogPath(path)).toBeUndefined()
    })
})

describe(catalogPathMatches, () => {
    const candidate = parseCatalogPath(
        "grapher/energy/2026-06-30/energy_mix/energy_mix#coal_twh"
    )!

    it("matches any version when the pattern's version is *", () => {
        const pattern = parseCatalogPath(
            "grapher/energy/*/energy_mix/energy_mix#coal_twh"
        )!
        expect(catalogPathMatches(pattern, candidate)).toBe(true)
    })

    it("matches only that version when the pattern has a fixed one", () => {
        const sameVersion = parseCatalogPath(
            "grapher/energy/2026-06-30/energy_mix/energy_mix#coal_twh"
        )!
        const otherVersion = parseCatalogPath(
            "grapher/energy/2025-06-27/energy_mix/energy_mix#coal_twh"
        )!
        expect(catalogPathMatches(sameVersion, candidate)).toBe(true)
        expect(catalogPathMatches(otherVersion, candidate)).toBe(false)
    })

    it.each([
        ["channel", "garden/energy/*/energy_mix/energy_mix#coal_twh"],
        ["namespace", "grapher/emissions/*/energy_mix/energy_mix#coal_twh"],
        ["dataset", "grapher/energy/*/electricity_mix/energy_mix#coal_twh"],
        ["table", "grapher/energy/*/energy_mix/energy_mix_monthly#coal_twh"],
        ["column", "grapher/energy/*/energy_mix/energy_mix#gas_twh"],
    ])("doesn't match a different %s", (_, path) => {
        expect(catalogPathMatches(parseCatalogPath(path)!, candidate)).toBe(
            false
        )
    })

    it("treats underscores in column names literally, not as wildcards", () => {
        // In a SQL LIKE pattern, "coal_twh" would also match "coalXtwh"
        const pattern = parseCatalogPath(
            "grapher/energy/*/energy_mix/energy_mix#coal_twh"
        )!
        const lookalike = parseCatalogPath(
            "grapher/energy/2026-06-30/energy_mix/energy_mix#coalXtwh"
        )!
        expect(catalogPathMatches(pattern, lookalike)).toBe(false)
    })

    it("doesn't match a column that only starts with the pattern's column", () => {
        const pattern = parseCatalogPath(
            "grapher/energy/*/energy_mix/energy_mix#coal_twh"
        )!
        const longer = parseCatalogPath(
            "grapher/energy/2026-06-30/energy_mix/energy_mix#coal_twh__sex_male"
        )!
        expect(catalogPathMatches(pattern, longer)).toBe(false)
    })

    describe("with an indicator of a table with dimensions", () => {
        // One of the many indicators made from the column "thr"
        const indicator = parseCatalogPath(
            "grapher/wb/2026-09-22/world_bank_pip/incomes#thr__ppp_version_2017__decile_1"
        )!

        it("matches the column the indicator was made from", () => {
            const pattern = parseCatalogPath(
                "grapher/wb/*/world_bank_pip/incomes#thr"
            )!
            expect(catalogPathMatches(pattern, indicator, "thr")).toBe(true)
        })

        it("still matches the indicator's own name", () => {
            const pattern = parseCatalogPath(
                "grapher/wb/*/world_bank_pip/incomes#thr__ppp_version_2017__decile_1"
            )!
            expect(catalogPathMatches(pattern, indicator, "thr")).toBe(true)
        })

        it("doesn't match another column of the table", () => {
            const pattern = parseCatalogPath(
                "grapher/wb/*/world_bank_pip/incomes#avg"
            )!
            expect(catalogPathMatches(pattern, indicator, "thr")).toBe(false)
        })

        it("doesn't match the same column of another table", () => {
            const pattern = parseCatalogPath(
                "grapher/wb/*/world_bank_pip/poverty#thr"
            )!
            expect(catalogPathMatches(pattern, indicator, "thr")).toBe(false)
        })
    })
})
