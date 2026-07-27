import { describe, expect, it } from "vitest"

import { computePyramidData, MigrantDemographics } from "./data.js"
import { RAW, RECORD } from "./testFixtures.js"

describe(computePyramidData, () => {
    it("derives native-born values and totals", () => {
        const data = computePyramidData(RECORD)
        expect(data.natives?.men).toEqual([90, 100])
        expect(data.natives?.women).toEqual([100, 100])
        expect(data.migrantsTotal).toEqual({ men: 30, women: 70, total: 100 })
        expect(data.nativesTotal).toEqual({ men: 190, women: 200, total: 390 })
    })

    it("clamps native-born values at zero", () => {
        const data = computePyramidData({
            m: [10],
            f: [0],
            pm: [5],
            pf: [0],
        })
        expect(data.natives?.men).toEqual([0])
    })

    it("omits the native-born population when there is no population data", () => {
        const data = computePyramidData({ m: [10], f: [20] })
        expect(data.migrantsTotal.total).toBe(30)
        expect(data.natives).toBeUndefined()
        expect(data.nativesTotal).toBeUndefined()
    })
})

describe(MigrantDemographics, () => {
    const data = new MigrantDemographics(RAW)

    it("maps UN names to display names and skips malformed entities", () => {
        expect(data.entityNames).toEqual([
            "World",
            "United States",
            "Kenya",
            "Monaco",
        ])
        expect(data.hasEntity("United States")).toBe(true)
        expect(data.hasEntity("Broken")).toBe(false)
    })

    it("keeps entities that only lack total-population data", () => {
        expect(data.hasEntity("Monaco")).toBe(true)
        expect(data.getPyramidData("Monaco", 2020)?.natives).toBeUndefined()
    })

    it("returns pyramid data by display name and year", () => {
        expect(data.getPyramidData("World", 2010)?.migrantsTotal.total).toBe(
            100
        )
        expect(data.getPyramidData("World", 1990)).toBeUndefined()
    })

    it("exposes entity names as a stable array", () => {
        expect(data.entityNames).toBe(data.entityNames)
    })
})
