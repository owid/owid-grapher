#! /usr/bin/env jestimport Enzyme from "enzyme"
import Adapter from "@wojtekmaj/enzyme-adapter-react-17"
import { GlobalEntitySelector } from "./GlobalEntitySelector"
import { SelectionArray } from "../../selection/SelectionArray"
Enzyme.configure({ adapter: new Adapter() })

describe("when you render a GlobalEntitySelector", () => {
    test("something renders", () => {
        const view = Enzyme.shallow(
            <GlobalEntitySelector selection={new SelectionArray()} />
        )
        expect(view.find(".global-entity-control")).not.toHaveLength(0)
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
