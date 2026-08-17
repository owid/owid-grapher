import { describe, expect, it } from "vitest"

import { computePyramidData, MigrantDemographics } from "./data.js"
import {
    computeAxisMax,
    computePyramidView,
    formatAgeBand,
    formatCountLong,
    formatSexShare,
    formatTooltipCount,
    formatTooltipShare,
} from "./helpers.js"
import { RAW, RECORD } from "./testFixtures.js"

describe(computePyramidView, () => {
    const data = computePyramidData(RECORD)
    const ageBands = ["0-4", "5+"]

    it("passes counts through in number mode, oldest band first", () => {
        const view = computePyramidView(data, ageBands, "number", false)
        expect(view.migrants).toEqual([
            { band: "5+", men: 20, women: 40 },
            { band: "0-4", men: 10, women: 30 },
        ])
        expect(view.natives).toBeUndefined()
    })

    it("computes shares of each whole population in share mode", () => {
        const view = computePyramidView(data, ageBands, "share", true)
        // The record's counts already sum to 100, so shares match them
        expect(view.migrants).toEqual([
            { band: "5+", men: 20, women: 40 },
            { band: "0-4", men: 10, women: 30 },
        ])
        // All migrant shares sum to 100
        const total = view.migrants.reduce((a, r) => a + r.men + r.women, 0)
        expect(total).toBeCloseTo(100)
        // Natives are reversed too, so the 0-4 band is last
        expect(view.natives?.at(-1)?.men).toBeCloseTo((90 / 390) * 100)
    })

    it("has nothing to compare while the comparison is off", () => {
        const view = computePyramidView(data, ageBands, "share", false)
        expect(view.natives).toBeUndefined()
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

describe(formatSexShare, () => {
    it("formats the share of a sex", () => {
        expect(formatSexShare(48, 100)).toBe("(48%)")
        expect(formatSexShare(1, 0)).toBeUndefined()
    })
})

describe(formatAgeBand, () => {
    it.each([
        ["25-29", "Ages 25–29"],
        ["0-4", "Ages 0–4"],
        ["75+", "Ages 75 and older"],
    ])("%s → %s", (band, expected) => {
        expect(formatAgeBand(band)).toBe(expected)
    })
})

describe(formatTooltipCount, () => {
    it("spells counts out in full, unlike the axis ticks", () => {
        expect(formatTooltipCount(2703412)).toBe("2,703,412")
        expect(formatTooltipCount(0)).toBe("0")
    })
})

describe(formatCountLong, () => {
    it("keeps three significant figures so totals don't look pre-rounded", () => {
        expect(formatCountLong(50632836)).toBe("50.6 million")
        expect(formatCountLong(280598105)).toBe("281 million")
        expect(formatCountLong(65424)).toBe("65,400")
    })
})

describe(formatTooltipShare, () => {
    it("formats shares to one decimal, keeping trailing zeroes", () => {
        expect(formatTooltipShare(3.24)).toBe("3.2%")
        expect(formatTooltipShare(2)).toBe("2.0%")
        expect(formatTooltipShare(0)).toBe("0.0%")
    })
})
