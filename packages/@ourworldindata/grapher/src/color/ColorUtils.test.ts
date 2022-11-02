#! /usr/bin/env jest

import { getLeastUsedColor, isDarkColor } from "./ColorUtils"

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

describe(isDarkColor, () => {
    it("black is dark", () => expect(isDarkColor("#000")).toEqual(true))
    it("white is light", () => expect(isDarkColor("#fff")).toEqual(false))
    it("can handle rgb", () =>
        expect(isDarkColor("rgb(0, 0, 0)")).toEqual(true))
    it("yellow is light", () => expect(isDarkColor("#ff1")).toEqual(false))
    it("green is dark", () => expect(isDarkColor("#2b2")).toEqual(true))
})
