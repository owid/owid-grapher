#! /usr/bin/env jest

import React from "react"
import {
    KeyInsightsSlides,
    KeyInsightsThumbs,
    KEY_INSIGHTS_CLASS_NAME,
    KEY_INSIGHTS_INSIGHT_PARAM,
} from "./KeyInsights.js"

import { KeyInsight } from "../../clientUtils/owidTypes.js"
import { fireEvent, render, screen } from "@testing-library/react"
import "@testing-library/jest-dom"
import { getWindowUrl } from "../../clientUtils/urls/Url.js"

const KEY_INSIGHTS_SLUG = "key-insights"

//from https://stackoverflow.com/a/62148101
beforeEach(() => {
    const mockIntersectionObserver = jest.fn()
    mockIntersectionObserver.mockReturnValue({
        observe: () => null,
        unobserve: () => null,
        disconnect: () => null,
    })
    window.IntersectionObserver = mockIntersectionObserver
})

const generateKeyInsights = (
    count: number,
    { isTitleHidden = false }: { isTitleHidden?: boolean } = {}
): KeyInsight[] => {
    return [...new Array(count)].map((_, idx) => ({
        title: `Key insight ${idx}`,
        slug: `key-insight-${idx}`,
        content: `content ${idx}`,
        isTitleHidden,
    }))
}

const renderKeyInsights = (keyInsights: KeyInsight[]) => {
    const slug = KEY_INSIGHTS_SLUG
    const title = "Key insights"
    const titles = keyInsights.map(({ title }) => title)

    render(
        <>
            <h3 id={slug}>{title}</h3>
            <div className={`${KEY_INSIGHTS_CLASS_NAME}`}>
                <div className="block-wrapper">
                    <KeyInsightsThumbs titles={titles} />
                </div>
                <KeyInsightsSlides insights={keyInsights} />
            </div>
        </>
    )
}

it("renders key insights with hidden titles", () => {
    const keyInsights = generateKeyInsights(3, { isTitleHidden: true })
    renderKeyInsights(keyInsights)

    expect(screen.getAllByRole("tab")).toHaveLength(3)
    expect(screen.queryAllByRole("heading", { level: 4 })).toHaveLength(0)
})

it("renders key insights and selects the first one", () => {
    const keyInsights = generateKeyInsights(3)
    renderKeyInsights(keyInsights)

    expect(screen.getAllByRole("tab")).toHaveLength(3)
    expect(screen.getByRole("tab", { selected: true })).toHaveTextContent(
        keyInsights[0].title
    )

    fireEvent.click(screen.getAllByRole("tab")[1])
    expect(screen.getByRole("tab", { selected: true })).toHaveTextContent(
        keyInsights[1].title
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
    expect(getWindowUrl().queryStr).toEqual(
        `?${KEY_INSIGHTS_INSIGHT_PARAM}=${keyInsights[1].slug}`
    )
})
