#! /usr/bin/env yarn jest

import { ChartDimension } from "./ChartDimension"
import { OwidTable } from "coreTable/OwidTable"
import { DimensionProperty } from "grapher/core/GrapherConstants"

it("can serialize for saving", () => {
    expect(
        new ChartDimension(
            { property: DimensionProperty.x, variableId: 1 },
            { table: new OwidTable() }
        ).toObject()
    ).toEqual({ property: "x", variableId: 1 })
})
