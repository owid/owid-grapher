import { expect, it } from "vitest"

import { SelectionArray } from "./SelectionArray"

it("can create a selection", () => {
    const selection = new SelectionArray()
    expect(selection.hasSelection).toEqual(false)

    selection.setSelectedEntities(["USA", "Canada"])
    expect(selection.hasSelection).toEqual(true)
    expect(selection.selectedEntityNames).toEqual(["USA", "Canada"])
})
