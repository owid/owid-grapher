import { describe, expect, it } from "vitest"

import { computePyramidData, MigrantDemographics } from "./data.js"
import {
    computeAxisMax,
    computePyramidView,
    formatSexShare,
} from "./helpers.js"
import { entityNameForSentence, toDisplayName } from "./entityNames.js"
import { RawMigrantDemographics, RawYearRecord } from "./types.js"

const RECORD: RawYearRecord = {
    m: [10, 20],
    f: [30, 40],
    pm: [100, 120],
    pf: [130, 140],
}

const RAW: RawMigrantDemographics = {
    meta: { title: "t", source: "s", unit: "persons" },
    ageBands: ["0-4", "5+"],
    years: [2010, 2020],
    entities: [
        {
            code: 900,
            name: "WORLD",
            isAggregate: true,
            data: { "2010": RECORD, "2020": RECORD },
        },
        {
            code: 840,
            name: "United States of America",
            data: {
                "2010": RECORD,
                "2020": { m: [5, 10], f: [10, 25], pm: [50, 50], pf: [50, 50] },
            },
        },
        // Natives heavily concentrated in one band (share 100% > any
        // migrant share)
        {
            code: 404,
            name: "Kenya",
            data: {
                "2010": {
                    m: [10, 10],
                    f: [10, 10],
                    pm: [110, 10],
                    pf: [10, 10],
                },
                "2020": {
                    m: [10, 10],
                    f: [10, 10],
                    pm: [110, 10],
                    pf: [10, 10],
                },
            },
        },
        // Malformed: missing a year
        { code: 1, name: "Broken", data: { "2010": RECORD } },
    ],
}

describe(computePyramidData, () => {
    it("derives native-born values and totals", () => {
        const data = computePyramidData(RECORD)
        expect(data.natives.men).toEqual([90, 100])
        expect(data.natives.women).toEqual([100, 100])
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
        expect(data.natives.men).toEqual([0])
    })
})

describe(computePyramidView, () => {
    const data = computePyramidData(RECORD)

    it("passes counts through in number mode", () => {
        const view = computePyramidView(data, "number", false)
        expect(view.migrants.men).toEqual([10, 20])
        expect(view.natives).toBeUndefined()
    })

    it("computes shares of each whole population in share mode", () => {
        const view = computePyramidView(data, "share", true)
        expect(view.migrants.men).toEqual([10, 20])
        expect(view.migrants.women).toEqual([30, 40])
        // All migrant shares sum to 100
        const total = [...view.migrants.men, ...view.migrants.women].reduce(
            (a, b) => a + b
        )
        expect(total).toBeCloseTo(100)
        expect(view.natives?.men[0]).toBeCloseTo((90 / 390) * 100)
    })
})

describe(MigrantDemographics, () => {
    const data = new MigrantDemographics(RAW)

    it("maps UN names to display names and skips malformed entities", () => {
        expect(data.entityNames).toEqual(["World", "United States", "Kenya"])
        expect(data.hasEntity("United States")).toBe(true)
        expect(data.hasEntity("Broken")).toBe(false)
    })

    it("returns pyramid data by display name and year", () => {
        expect(data.getPyramidData("World", 2010)?.migrantsTotal.total).toBe(
            100
        )
        expect(data.getPyramidData("World", 1990)).toBeUndefined()
    })
})

describe(computeAxisMax, () => {
    const data = new MigrantDemographics(RAW)

    it("takes the maximum across all years", () => {
        // 2010 record has max band count 40; 2020 has 25
        expect(computeAxisMax(data, "United States", "number", false)).toBe(40)
    })

    it("includes the native-born values when comparing", () => {
        const withoutNatives = computeAxisMax(data, "Kenya", "share", false)
        const withNatives = computeAxisMax(data, "Kenya", "share", true)
        expect(withoutNatives).toBe(25) // each migrant band is 10 of 40
        expect(withNatives).toBeCloseTo(100) // all natives are men aged 0-4
    })
})

describe(toDisplayName, () => {
    it("maps divergent UN country names to OWID names", () => {
        expect(toDisplayName("Viet Nam")).toBe("Vietnam")
        expect(toDisplayName("Russian Federation")).toBe("Russia")
    })

    it("keeps matching names as-is", () => {
        expect(toDisplayName("Kenya")).toBe("Kenya")
        expect(toDisplayName("Sub-Saharan Africa")).toBe("Sub-Saharan Africa")
    })

    it("title-cases all-caps UN aggregates", () => {
        expect(toDisplayName("WORLD")).toBe("World")
        expect(toDisplayName("LATIN AMERICA AND THE CARIBBEAN")).toBe(
            "Latin America and the Caribbean"
        )
    })
})

describe(entityNameForSentence, () => {
    it.each([
        ["World", "the world"],
        ["United States", "the United States"],
        ["Kenya", "Kenya"],
        ["Caribbean", "the Caribbean"],
        ["High-income countries", "high-income countries"],
        ["Less developed regions", "less developed regions"],
    ])("%s → %s", (name, expected) => {
        expect(entityNameForSentence(name)).toBe(expected)
    })
})

describe(formatSexShare, () => {
    it("formats the share of a sex", () => {
        expect(formatSexShare(48, 100)).toBe("(48%)")
        expect(formatSexShare(1, 0)).toBe("")
    })
})
