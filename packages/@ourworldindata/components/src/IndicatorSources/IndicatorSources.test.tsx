/**
 * @vitest-environment happy-dom
 */

import { describe, expect, it } from "vitest"
import { render } from "@testing-library/react"
import { IndicatorSources } from "./IndicatorSources.js"

// hideTeasers as in the metadata box (a teaser repeats the toggle's content).
describe(IndicatorSources, () => {
    it("shows a shared source's per-indicator links and citations instead of its own", () => {
        const { container } = render(
            <IndicatorSources
                hideTeasers
                sources={[
                    {
                        label: "World Bank – World Development Indicators",
                        description: "The WDI database.",
                        retrievedOn: "2026-02-27",
                        retrievedFrom: "https://data.worldbank.org",
                        citation: "World Bank (2026).",
                        variants: [
                            {
                                label: "Urban population",
                                retrievedFrom:
                                    "https://data.worldbank.org/indicator/SP.URB.TOTL",
                                citation: "Indicator SP.URB.TOTL.",
                            },
                            {
                                label: "Rural population",
                                retrievedFrom:
                                    "https://data.worldbank.org/indicator/SP.RUR.TOTL",
                                citation: "Indicator SP.RUR.TOTL.",
                            },
                        ],
                    },
                ]}
            />
        )
        const rows = [
            ...container.querySelectorAll(".source-key-data--variant"),
        ]
        expect(
            rows.map(
                (r) => r.querySelector(".source-key-data__title")?.textContent
            )
        ).toEqual(["Urban population", "Rural population"])
        const hrefs = [
            ...container.querySelectorAll(".source-key-data--variant a"),
        ].map((a) => a.getAttribute("href"))
        expect(hrefs).toContain(
            "https://data.worldbank.org/indicator/SP.URB.TOTL"
        )
        // the single "Retrieved from" / "Citation" rows give way to the variants
        expect(container.textContent).not.toContain("World Bank (2026).")
    })

    it("renders the single link and citation when there are no variants", () => {
        const { container } = render(
            <IndicatorSources
                hideTeasers
                sources={[
                    {
                        label: "UN – World Population Prospects",
                        retrievedFrom: "https://population.un.org",
                        citation: "UN (2024).",
                    },
                ]}
            />
        )
        expect(container.querySelector(".source-key-data--variant")).toBeNull()
        expect(container.textContent).toContain("UN (2024).")
    })
})
