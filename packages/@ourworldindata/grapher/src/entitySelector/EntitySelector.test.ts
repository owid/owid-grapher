import { describe, expect, it } from "vitest"
import { Grapher } from "../core/Grapher"
import {
    SynthesizeFruitTable,
    SynthesizeGDPTable,
} from "@ourworldindata/core-table"

it("updates the selection based on the active tab", () => {
    const grapher = new Grapher()

    // updates the chart selection when shown next to the chart
    grapher.entitySelector.onChange("Italy")
    expect(grapher.selection.selectedEntityNames).toEqual(["Italy"])

    // after switching to the map tab, the entity selector updates the map selection
    grapher.tab = "map"
    grapher.entitySelector.onChange("Spain")
    expect(grapher.map.selection.selectedEntityNames).toEqual(["Spain"])
})

describe("filter by dropdown", () => {
    it("doesn't show a dropdown for non-geographic data", () => {
        const table = SynthesizeFruitTable()
        const grapher = new Grapher({ table })
        expect(grapher.entitySelector.shouldShowFilterBar).toBe(false)
    })

    it("doesn't show a dropdown if there is a single category", () => {
        const table = SynthesizeGDPTable({ entityNames: ["Spain", "France"] })
        const grapher = new Grapher({ table })
        expect(grapher.entitySelector.shouldShowFilterBar).toBe(false)
    })

    it("shows a dropdown if there are at least two categories", () => {
        const table = SynthesizeGDPTable({
            entityNames: ["Spain", "France", "Europe"],
        })
        const grapher = new Grapher({ table })
        expect(grapher.entitySelector.shouldShowFilterBar).toBe(true)
        expect(
            grapher.entitySelector.filterOptions.map((option) => option.value)
        ).toEqual(["all", "countries", "continents"])
    })
})
