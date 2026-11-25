import { describe, expect, it } from "vitest"

import {
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
            "How is income distributed across the world's population?"
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
            "How is income distributed in China, the United States, India and Nigeria?"
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
