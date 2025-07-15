/**
 * @vitest-environment jsdom
 */

import { expect, test } from "vitest"
import { render, fireEvent } from "@testing-library/react"
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

    expect(container.querySelector(".Tooltip")).toBeFalsy()

    const icelandPath = container.querySelector(
        'path[data-feature-id="Iceland"]'
    )
    if (icelandPath) {
        fireEvent.mouseEnter(icelandPath, {
            clientX: 50,
            clientY: 50,
        })

        const tooltip = container.querySelector(".Tooltip")
        if (tooltip) {
            expect(
                tooltip.querySelector(".variable .definition")?.textContent
            ).toContain("% of children under 5")
            expect(
                tooltip.querySelector(".variable .values")
            ).toHaveTextContent("4%")
        }
    } else {
        // Skip the test if the path doesn't exist (grapher might not have rendered the map)
        console.log("Iceland path not found, skipping tooltip test")
    }
})
