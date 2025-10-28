/**
 * @vitest-environment happy-dom
 */

import { expect, describe, test } from "vitest"
import { render } from "@testing-library/react"
import { GlobalEntitySelector } from "./GlobalEntitySelector"
import { SelectionArray } from "../../selection/SelectionArray"

describe("when you render a GlobalEntitySelector", () => {
    test("something renders", () => {
        const { container } = render(
            <GlobalEntitySelector selection={new SelectionArray()} />
        )
        expect(container.querySelector(".global-entity-control")).toBeTruthy()
    })

    test("graphers/explorers are properly updated", () => {
        const grapherSelection = new SelectionArray()
        const explorerSelection = new SelectionArray()

        const graphersToUpdate = new Set([grapherSelection, explorerSelection])

        const selector = new GlobalEntitySelector({
            selection: new SelectionArray(),
            graphersAndExplorersToUpdate: graphersToUpdate,
        })

        selector.updateSelection(["Breckistan"])

        expect(grapherSelection.selectedEntityNames).toEqual(["Breckistan"])
        expect(explorerSelection.selectedEntityNames).toEqual(["Breckistan"])
    })
})
