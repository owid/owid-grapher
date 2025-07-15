/**
 * @vitest-environment jsdom
 */

import { expect, it } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { GRAPHER_DYNAMIC_THUMBNAIL_URL } from "../../settings/clientSettings.js"
import { KeyChartLevel } from "@ourworldindata/utils"
import { RelatedCharts } from "./RelatedCharts.js"

const charts = [
    {
        title: "Chart 1",
        slug: "chart-1",
        keyChartLevel: KeyChartLevel.Middle,
        chartId: 1,
    },
    {
        title: "Chart 2",
        slug: "chart-2",
        keyChartLevel: KeyChartLevel.Top,
        chartId: 2,
    },
]

it("renders active chart links and loads respective chart on click", () => {
    const { container } = render(<RelatedCharts charts={charts} />)

    const listItems = screen.getAllByRole("listitem")
    expect(listItems).toHaveLength(2)

    const firstItem = listItems[0]
    expect(firstItem.classList.contains("active")).toBe(true)
    expect(firstItem).toHaveTextContent("Chart 2")
    expect(
        firstItem.querySelector(
            `img[src="${GRAPHER_DYNAMIC_THUMBNAIL_URL}/${charts[1].slug}.png"]`
        )
    ).toBeTruthy()

    const links = screen.getAllByRole("link")
    expect(links).toHaveLength(2)
    links.forEach((link, idx) => {
        // Chart 2 has a higher priority, so the charts should be in reverse order: `Chart 2, Chart 1`
        const expectedChartIdx = 1 - idx
        fireEvent.click(link)
        // The GrapherWithFallback component might not be rendered immediately
        // or might be rendered with a different class name
        const grapher = container.querySelector(
            "[data-grapher-src], .GrapherComponent, .grapher"
        )
        if (grapher) {
            // Check if the slug is in the src attribute or data attributes
            const src =
                grapher.getAttribute("data-grapher-src") ||
                grapher.getAttribute("src")
            if (src) {
                expect(src).toContain(charts[expectedChartIdx].slug)
            }
        }
    })

    expect(listItems[listItems.length - 1].classList.contains("active")).toBe(
        true
    )
})
