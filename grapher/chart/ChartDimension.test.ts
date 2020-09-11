#! /usr/bin/env yarn jest

import { ChartDimension } from "./ChartDimension"
import { OwidTable } from "owidTable/OwidTable"

describe(ChartDimension, () => {
    it("can serialize for saving", () => {
        expect(
            new ChartDimension(
                { property: "x", variableId: 1 },
                new OwidTable([])
            ).toObject()
        ).toEqual({ property: "x", variableId: 1 })
    })
})
