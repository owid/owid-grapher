import { describe, expect, it } from "vitest"

import { ChartDimension } from "./ChartDimension"
import { BlankOwidTable } from "@ourworldindata/core-table"
import { DimensionProperty } from "@ourworldindata/utils"

it("can serialize for saving", () => {
    expect(
        new ChartDimension(
            { property: DimensionProperty.x, variableId: 1 },
            { table: BlankOwidTable() }
        ).toObject()
    ).toEqual({ property: "x", variableId: 1 })
})

describe("a slot naming a column with slug", () => {
    const manager = { table: BlankOwidTable() }

    it("uses the authored slug as its column, with no variable id", () => {
        const dimension = new ChartDimension(
            { property: DimensionProperty.y, slug: "rent_index" },
            manager
        )
        expect(dimension.columnSlug).toBe("rent_index")
        expect(dimension.variableId).toBeUndefined()
    })

    it("writes the authored slug back out", () => {
        const config = {
            property: DimensionProperty.y,
            slug: "rent_index",
            display: { name: "Rents" },
        }
        const dimension = new ChartDimension(config, manager)
        expect(dimension.toObject()).toEqual(config)
    })

    it("does not write out a slug derived from a variable id", () => {
        const dimension = new ChartDimension(
            { property: DimensionProperty.y, variableId: 815383 },
            manager
        )
        expect(dimension.columnSlug).toBe("815383")
        expect(dimension.toObject()).toEqual({
            property: DimensionProperty.y,
            variableId: 815383,
        })
    })
})

describe("setting targetYear", () => {
    const manager = { table: BlankOwidTable() }

    it("names the indicator column by variable id and year", () => {
        const dimension = new ChartDimension(
            { property: DimensionProperty.x, variableId: 1 },
            manager
        )
        dimension.targetYear = 2000
        expect(dimension.columnSlug).toBe("1-2000")
        expect(dimension.toObject()).toEqual({
            property: DimensionProperty.x,
            variableId: 1,
            targetYear: 2000,
        })
    })

    it("refuses to set targetYear on a slug column", () => {
        const dimension = new ChartDimension(
            { property: DimensionProperty.x, slug: "rent_index" },
            manager
        )
        expect(() => (dimension.targetYear = 2000)).toThrow()
        expect(dimension.toObject()).toEqual({
            property: DimensionProperty.x,
            slug: "rent_index",
        })
    })

    it("accepts clearing the year on a slug column", () => {
        const dimension = new ChartDimension(
            { property: DimensionProperty.x, slug: "rent_index" },
            manager
        )
        dimension.targetYear = undefined
        expect(dimension.targetYear).toBeUndefined()
    })
})
