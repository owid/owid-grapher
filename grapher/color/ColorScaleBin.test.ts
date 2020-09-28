#! /usr/bin/env yarn jest

import { CategoricalBin } from "./ColorScaleBin"

it("can create a bin", () => {
    const bin = new CategoricalBin({
        index: 1,
        value: "North America",
        label: "100",
        color: "red",
    })
    expect(bin.color).toEqual("red")
})
