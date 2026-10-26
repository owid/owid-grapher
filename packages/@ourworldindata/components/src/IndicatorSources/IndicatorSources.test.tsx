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
})
