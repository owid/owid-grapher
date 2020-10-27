#! /usr/bin/env yarn jest

import { SelectionArray, SelectionManager } from "./SelectionArray"

it("can create a selection", () => {
    const manager: SelectionManager = {
        availableEntities: [{ entityName: "USA" }, { entityName: "Canada" }],
        selectedEntityNames: [],
    }

    const selection = new SelectionArray(manager)
    expect(selection.hasSelection).toEqual(false)

    selection.selectAll()
    expect(selection.hasSelection).toEqual(true)
    expect(manager.selectedEntityNames).toEqual(["USA", "Canada"])
})
