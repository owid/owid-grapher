import { describe, expect, it } from "vitest"

import { noteText } from "./dods.js"
import {
    chartNoteSegments,
    chartSubtitle,
    chartTitle,
    livingOnLessThanPhrase,
} from "./chartText.js"
import { INTERNATIONAL_DOLLAR } from "./constants.js"
import type { Currency } from "./types.js"

const EURO: Currency = {
    code: "EUR",
    name: "Euro",
    factor: 0.5,
    countryName: "Germany",
    countryCode: "DEU",
}

describe(chartTitle, () => {
    it("asks about the world in the global view, whatever is selected", () => {
        expect(chartTitle("global", ["China"])).toBe(
            "How is income distributed across the world’s population?"
        )
    })

    it("names up to four countries as they read in a sentence", () => {
        expect(chartTitle("countries", ["China"])).toBe(
            "How is income distributed in China?"
        )
        expect(
            chartTitle("countries", [
                "China",
                "United States",
                "India",
                "Nigeria",
            ])
        ).toBe(
            "How is income distributed in China, the United States, India, and Nigeria?"
        )
    })

    it("stops naming them past four, and asks generally with none", () => {
        expect(
            chartTitle("countries", [
                "China",
                "United States",
                "India",
                "Nigeria",
                "Brazil",
            ])
        ).toBe("How is income distributed across different countries?")
        expect(chartTitle("countries", [])).toBe(
            "How is income distributed in the selected countries?"
        )
    })
})

describe(chartSubtitle, () => {
    it("explains international dollars", () => {
        expect(chartSubtitle(2025, INTERNATIONAL_DOLLAR)).toBe(
            "Data for 2025, measured in international dollars, which adjusts for differences in the cost of living between countries."
        )
    })

    it("names a local currency with its country", () => {
        expect(chartSubtitle(2020, EURO)).toBe(
            "Data for 2020, measured in Euro (Germany), adjusted for differences in the cost of living."
        )
    })
})

describe(livingOnLessThanPhrase, () => {
    it("states the line in the chart's units and interval", () => {
        expect(livingOnLessThanPhrase(3, INTERNATIONAL_DOLLAR, "daily")).toBe(
            "living on less than $3.00 a day"
        )
        expect(
            livingOnLessThanPhrase(3, INTERNATIONAL_DOLLAR, "daily", {
                short: true,
            })
        ).toBe("living on less than $3 a day")
        // $10 a day at 0.5 EUR per int-$ is 5 EUR a day, 152 EUR a month
        expect(livingOnLessThanPhrase(10, EURO, "monthly")).toBe(
            "living on less than €150 a month"
        )
    })
})

describe(chartNoteSegments, () => {
    const GENERAL =
        "Depending on the country, the data relates to income measured after taxes and benefits, or to consumption, per capita."

    it("explains the data in general, as one string", () => {
        expect(chartNoteSegments(INTERNATIONAL_DOLLAR, 2020, false)).toEqual([
            GENERAL,
        ])
    })

    it("adds the international line's definition, the nowcast caveat and the conversion", () => {
        const segments = chartNoteSegments(EURO, 2025, true)
        expect(noteText(segments)).toBe(
            `${GENERAL} The International Poverty Line is set by the World\u00a0Bank as its definition of extreme poverty. Figures for 2025 are World\u00a0Bank nowcasts, which extrapolate the latest household surveys using economic growth. Incomes in local currencies are converted from international-$ using purchasing power parity (PPP) conversion factors and adjusted for inflation to the latest year available.`
        )
        // "nowcasts" is a term with a card; the strings around it are merged
        expect(segments).toHaveLength(3)
        expect(segments[1]).toEqual({ dod: "nowcast" })
        expect(
            noteText(
                chartNoteSegments({ ...EURO, pricesYear: 2024 }, 2020, false)
            )
        ).toContain("adjusted for inflation to 2024 prices.")
    })

    it("lets the countries' own sentence replace the general one, keeping its terms as segments", () => {
        expect(
            chartNoteSegments(INTERNATIONAL_DOLLAR, 2025, false, [
                "Germany reports ",
                { dod: "income" },
                ".",
            ])
        ).toEqual([
            "Germany reports ",
            { dod: "income" },
            ". Figures for 2025 are ",
            { dod: "nowcast" },
            ", which extrapolate the latest household surveys using economic growth.",
        ])
    })
})
