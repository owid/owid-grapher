#! /usr/bin/env yarn jest

// todo: remove this when we remove chartDimension

import { ChartDimension } from "./ChartDimension"
import { BlankOwidTable } from "coreTable/OwidTable"
import { DimensionProperty } from "grapher/core/GrapherConstants"

it("can serialize for saving", () => {
    expect(
        new ChartDimension(
            { property: DimensionProperty.x, variableId: 1 },
            { table: BlankOwidTable() }
        ).toObject()
    ).toEqual({ property: "x", variableId: 1 })
})
