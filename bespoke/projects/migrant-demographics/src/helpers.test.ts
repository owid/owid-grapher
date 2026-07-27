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

    it("has nothing to compare without population data", () => {
        const withoutPopulation = computePyramidData({ m: [10], f: [30] })
        const view = computePyramidView(withoutPopulation, "share", true)
        expect(view.migrants.men).toEqual([25])
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
        expect(formatSexShare(1, 0)).toBe("")
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
