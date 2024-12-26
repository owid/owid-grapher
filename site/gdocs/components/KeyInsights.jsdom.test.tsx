#! /usr/bin/env jest

import {
    EnrichedBlockKeyInsights,
    EnrichedBlockKeyInsightsSlide,
    getWindowUrl,
    slugify,
} from "@ourworldindata/utils"
import { fireEvent, render, screen } from "@testing-library/react"
import "@testing-library/jest-dom"

import { jest } from "@jest/globals"
import ArticleBlock from "./ArticleBlock.js"
import { KEY_INSIGHTS_INSIGHT_PARAM } from "./KeyInsights.js"

const KEY_INSIGHTS_SLUG = "key-insights"

//from https://stackoverflow.com/a/62148101
beforeEach(() => {
    const mockIntersectionObserver = jest.fn()
    mockIntersectionObserver.mockReturnValue({
        observe: () => null,
        unobserve: () => null,
        disconnect: () => null,
    })
    window.IntersectionObserver = mockIntersectionObserver as any
})

const generateKeyInsights = (count: number): EnrichedBlockKeyInsights => {
    return {
        type: "key-insights",
        heading: "Key insights",
        parseErrors: [],
        insights: [...new Array(count)].map((_, idx) => ({
            title: `Key insight ${idx}`,
            type: "key-insight-slide",
            url: "https://ourworldindata.org/grapher/life-expectancy",
            content: [],
        })) as EnrichedBlockKeyInsightsSlide[],
    }
}

const renderKeyInsights = (keyInsightsBlock: EnrichedBlockKeyInsights) => {
    render(
        <div>
            <p>test??</p>
            <ArticleBlock b={keyInsightsBlock} />
        </div>
    )
}

it("renders key insights and selects the first one", () => {
    const keyInsights = generateKeyInsights(3)
    renderKeyInsights(keyInsights)

    expect(screen.getAllByRole("tab")).toHaveLength(3)
    expect(screen.getByRole("tab", { selected: true })).toHaveTextContent(
        keyInsights.insights[0].title
    )

    fireEvent.click(screen.getAllByRole("tab")[1])
    expect(screen.getByRole("tab", { selected: true })).toHaveTextContent(
        keyInsights.insights[1].title
    )
})

it("selects the second key insight", () => {
    const keyInsights = generateKeyInsights(3)
    renderKeyInsights(keyInsights)

    fireEvent.click(screen.getAllByRole("tab")[1])
    // ideally, we would be using a more semantic attribute and test against the
    // visible element. However, I couldn't find a combination of hidden attr /
    // aria-hidden / display: none that would be both right in terms of
    // accessibility and pass the test
    expect(screen.getAllByRole("tabpanel")[1]).toHaveAttribute(
        "data-active",
        "true"
    )
})

it("updates the URL", () => {
    const keyInsights = generateKeyInsights(3)
    renderKeyInsights(keyInsights)

    fireEvent.click(screen.getAllByRole("tab")[1])
    expect(getWindowUrl().hash).toEqual(`#${KEY_INSIGHTS_SLUG}`)
    const slugifiedTitle = slugify(keyInsights.insights[1].title)
    expect(getWindowUrl().queryStr).toEqual(
        `?${KEY_INSIGHTS_INSIGHT_PARAM}=${slugifiedTitle}`
    )
})
