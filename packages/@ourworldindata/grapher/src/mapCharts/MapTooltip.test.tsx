/**
 * @vitest-environment jsdom
 */

import { assert, expect, test } from "vitest"
import { render, fireEvent, screen } from "@testing-library/react"
import { Grapher, GrapherState } from "../core/Grapher.js"
import { legacyMapGrapher, legacyMapGrapherData } from "./MapChart.sample.js"
import { legacyToOwidTableAndDimensionsWithMandatorySlug } from "../core/LegacyToOwidTable.js"

const state = new GrapherState({ ...legacyMapGrapher })
state.inputTable = legacyToOwidTableAndDimensionsWithMandatorySlug(
    legacyMapGrapherData,
    legacyMapGrapher.dimensions!,
    legacyMapGrapher.selectedEntityColors
)

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
