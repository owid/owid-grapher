#! /usr/bin/env yarn jest

import { PersistableChartDimension } from "./ChartDimension"

describe(PersistableChartDimension, () => {
    it("can serialize for saving", () => {
        expect(new PersistableChartDimension().toObject()).toEqual({})
    })
})
