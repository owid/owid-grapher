#! /usr/bin/env yarn jest

import { generateContinentRows, getLeastUsedColor } from "./CovidExplorerUtils"
import { covidSampleRows } from "./CovidSampleRows"

it("correctly groups continents and adds rows for each", () => {
    const regionRows = generateContinentRows(covidSampleRows)
    expect(regionRows.length).toEqual(6)
    expect(regionRows[regionRows.length - 1].total_cases).toEqual(46451)
})

describe(getLeastUsedColor, () => {
    it("returns unused color", () => {
        expect(getLeastUsedColor(["red", "green"], ["red"])).toEqual("green")
    })

    it("returns least used color", () => {
        expect(
            getLeastUsedColor(["red", "green"], ["red", "green", "green"])
        ).toEqual("red")
    })
})
