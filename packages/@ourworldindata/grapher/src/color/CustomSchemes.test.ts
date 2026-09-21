import { expect, it } from "vitest"
import { ContinentColors, MapContinentColors } from "./CustomSchemes"

it("pins the same regions for charts and for maps", () => {
    // A region pinned in only one of the two gets its color from the positional
    // palette in the other, so it reads as two different colors between a chart
    // and its map
    expect(new Set(Object.keys(ContinentColors))).toEqual(
        new Set(Object.keys(MapContinentColors))
    )
})
