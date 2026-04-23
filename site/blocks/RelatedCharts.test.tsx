/**
 * @vitest-environment happy-dom
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
    render(<RelatedCharts charts={charts} />)

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

    links.forEach((link, i) => {
        fireEvent.click(link)
        expect(screen.getByText(`Chart ${i + 1} of 2`)).toBeTruthy()
        expect(listItems[i].classList.contains("active")).toBe(true)
        expect(document.getElementById(`related-chart-${i}`)).toBeTruthy()
    })

    expect(
        listItems[listItems.length - 1].classList.contains("active")
    ).toBeTruthy()
})
