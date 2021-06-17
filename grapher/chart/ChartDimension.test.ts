#! /usr/bin/env jest

// todo: remove this when we remove chartDimension

import { ChartDimension } from "./ChartDimension"
import { BlankOwidTable } from "../../coreTable/OwidTable"
import { DimensionProperty } from "../../clientUtils/owidTypes"

it("can serialize for saving", () => {
    expect(
        new ChartDimension(
            { property: DimensionProperty.x, variableId: 1 },
            { table: BlankOwidTable() }
        ).toObject()
    ).toEqual({ property: "x", variableId: 1 })
})
