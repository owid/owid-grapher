/**
 * @vitest-environment happy-dom
 */

import { describe, expect, it } from "vitest"
import { render } from "@testing-library/react"
import { DisplaySource } from "@ourworldindata/utils"
import { IndicatorSources } from "./IndicatorSources.js"

const source: DisplaySource = {
    label: "World Bank",
    retrievedFrom: "https://data.worldbank.org; https://example.org/more",
}

describe(IndicatorSources, () => {
    it("opens 'Retrieved from' links in the same tab by default", () => {
        const { container } = render(<IndicatorSources sources={[source]} />)
        const links = container.querySelectorAll("a[href^='https://']")
        expect(links).toHaveLength(2)
        for (const link of links) expect(link.getAttribute("target")).toBeNull()
    })

    it("opens 'Retrieved from' links in a new tab when asked to (e.g. in an iframe)", () => {
        const { container } = render(
            <IndicatorSources sources={[source]} openLinksInNewTab />
        )
        const links = container.querySelectorAll("a[href^='https://']")
        expect(links).toHaveLength(2)
        for (const link of links) {
            expect(link.getAttribute("target")).toBe("_blank")
            expect(link.getAttribute("rel")).toBe("noopener")
        }
    })

    it("shows each indicator's link and citation in place of the source's own", () => {
        const { container } = render(
            <IndicatorSources
                // As in the metadata box: a teaser would repeat the content
                hideTeasers
                openLinksInNewTab
                sources={[
                    {
                        label: "World Bank – World Development Indicators",
                        retrievedFrom: "https://data.worldbank.org",
                        citation: "World Bank (2026).",
                        indicatorLinks: [
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
        const links = [...container.querySelectorAll("a[href^='https://']")]
        expect(links.map((link) => link.getAttribute("href"))).toEqual([
            "https://data.worldbank.org/indicator/SP.URB.TOTL",
            "https://data.worldbank.org/indicator/SP.RUR.TOTL",
        ])
        for (const link of links)
            expect(link.getAttribute("target")).toBe("_blank")
        expect(container.textContent).toContain("Urban population")
        expect(container.textContent).toContain("Indicator SP.RUR.TOTL.")
        expect(container.textContent).not.toContain("World Bank (2026).")
    })
})
