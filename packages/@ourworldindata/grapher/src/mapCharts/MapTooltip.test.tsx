/**
 * @vitest-environment happy-dom
 */

import { afterAll, assert, beforeAll, expect, test, vi } from "vitest"
import { render, fireEvent, screen } from "@testing-library/react"
import { Grapher } from "../core/Grapher.js"
import { GrapherState } from "../core/GrapherState.js"
import { legacyMapGrapher, legacyMapGrapherData } from "./MapChart.sample.js"
import { legacyToOwidTableAndDimensionsWithMandatorySlug } from "../core/LegacyToOwidTable.js"

const state = new GrapherState({ ...legacyMapGrapher })
state.inputTable = legacyToOwidTableAndDimensionsWithMandatorySlug(
    legacyMapGrapherData,
    legacyMapGrapher.dimensions!,
    legacyMapGrapher.selectedEntityColors
)

beforeAll(() => {
    // Replace IntersectionObserver with a mock that always calls the callback immediately when
    // `observe` is called. This ensures that Grapher is rendering, and doesn't wait for the
    // element to become visible first (which doesn't happen in the test environment).
    const IntersectionObserverMock = class IntersectionObserverMock extends IntersectionObserver {
        constructor(public callback: IntersectionObserverCallback) {
            super(callback)
        }

        override observe(elem: Element): void {
            this.callback(
                [
                    {
                        isIntersecting: true,
                        target: elem,
                        boundingClientRect: {} as DOMRectReadOnly,
                        intersectionRatio: 1,
                        intersectionRect: {} as DOMRectReadOnly,
                        rootBounds: null,
                        time: Date.now(),
                    },
                ],
                this
            )
        }
        override unobserve = vi.fn()
        override disconnect = vi.fn()
    }

    vi.stubGlobal("IntersectionObserver", IntersectionObserverMock)
})

afterAll(() => {
    vi.unstubAllGlobals()
})

test("map tooltip renders iff mouseenter", () => {
    const { container } = render(<Grapher grapherState={state} />)

    expect(screen.queryByRole("tooltip")).toBeFalsy()

    const icelandPath = container.querySelector(
        'path[data-feature-id="Iceland"]'
    )
    assert(icelandPath, "Iceland path should exist")
    fireEvent.mouseEnter(icelandPath, {
        clientX: 50,
        clientY: 50,
    })

    const tooltip = screen.getByRole("tooltip")

    expect(
        tooltip.querySelector(".variable .definition")?.textContent
    ).toContain("% of children under 5")
    expect(tooltip.querySelector(".variable .values")).toHaveTextContent("4%")
})
