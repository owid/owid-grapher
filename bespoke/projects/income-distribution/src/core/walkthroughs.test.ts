import { describe, expect, it } from "vitest"

import { INTERNATIONAL_DOLLAR } from "./constants.js"
import { richTextToPlain } from "./richText.js"
import { YEAR } from "./testFixtures.js"
import type { Currency } from "./types.js"
import type { ChartState } from "./useIncomeDistributionState.js"
import {
    clampSlide,
    formatOneInTen,
    resolveSlideChartState,
    resolveSlideText,
    shareBelow,
    WALKTHROUGHS,
    type SlideChartField,
} from "./walkthroughs.js"

const EURO: Currency = {
    code: "EUR",
    name: "Euro",
    factor: 0.85,
    countryName: "Germany",
    countryCode: "DEU",
}

const READER_STATE: ChartState = {
    view: "countries",
    selectedCountries: ["Middleland"],
    povertyLine: 3,
    timeInterval: "daily",
    currency: EURO,
}

const hasCountry = (name: string): boolean => YEAR.byName.has(name)

describe(resolveSlideChartState, () => {
    it("shows the slide's state over the reader's", () => {
        expect(
            resolveSlideChartState(
                READER_STATE,
                {
                    view: "global",
                    povertyLine: null,
                    timeInterval: "monthly",
                    currency: INTERNATIONAL_DOLLAR,
                },
                new Set(),
                hasCountry
            )
        ).toEqual({
            view: "global",
            selectedCountries: ["Middleland"],
            povertyLine: null,
            timeInterval: "monthly",
            currency: INTERNATIONAL_DOLLAR,
        })
    })

    it("keeps the reader's fields that the slide's control has released", () => {
        const released = new Set<SlideChartField>(["currency", "timeInterval"])
        const state = resolveSlideChartState(
            READER_STATE,
            {
                view: "global",
                timeInterval: "monthly",
                currency: INTERNATIONAL_DOLLAR,
            },
            released,
            hasCountry
        )
        expect(state.currency).toBe(EURO)
        expect(state.timeInterval).toBe("daily")
        expect(state.view).toBe("global")
    })

    it("leaves out countries the data doesn't have", () => {
        const state = resolveSlideChartState(
            READER_STATE,
            { countries: ["Richland", "Atlantis", "Poorland"] },
            new Set(),
            hasCountry
        )
        expect(state.selectedCountries).toEqual(["Richland", "Poorland"])
    })
})

describe(clampSlide, () => {
    const walkthrough = WALKTHROUGHS[0]
    it("keeps slide numbers within the walkthrough", () => {
        expect(clampSlide(0, walkthrough)).toBe(1)
        expect(clampSlide(3, walkthrough)).toBe(3)
        expect(clampSlide(99, walkthrough)).toBe(walkthrough.slides.length)
        expect(clampSlide(Number.NaN, walkthrough)).toBe(1)
    })
})

describe(formatOneInTen, () => {
    it("rounds to tenths", () => {
        expect(formatOneInTen(0.81)).toBe("8 in 10")
        expect(formatOneInTen(0.1)).toBe("1 in 10")
        expect(formatOneInTen(0.02)).toBe("fewer than 1 in 10")
    })
})

describe("walkthrough texts", () => {
    it("quote the data's figures", () => {
        const [, insights] = WALKTHROUGHS
        const globalShare = shareBelow(YEAR, "World", (1000 * 12) / 365)
        const text = resolveSlideText(insights.slides[3].text, YEAR)
        expect(richTextToPlain(text)).toBe(
            `Globally, ${formatOneInTen(globalShare)} people in the world live in poverty by this definition.`
        )
    })

    it("only use markers that parse into whole runs", () => {
        for (const walkthrough of WALKTHROUGHS)
            for (const slide of walkthrough.slides) {
                const text = resolveSlideText(slide.text, YEAR)
                expect(richTextToPlain(text)).not.toMatch(/\*|\[\[|\]\]/)
            }
    })
})
