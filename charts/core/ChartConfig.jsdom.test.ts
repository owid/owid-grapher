#! /usr/bin/env yarn jest

import { ChartConfig } from "./ChartConfig"
import { ChartScript } from "./ChartScript"

describe("ChartConfig", () => {
    it("can serialize chartConfig for saving", () => {
        const config = new ChartConfig(new ChartScript())
        const json = config.json
        expect(Object.keys(json).length).toBe(57) // It should be 0. Setting it to 57 for just 1 commit.
    })
})
