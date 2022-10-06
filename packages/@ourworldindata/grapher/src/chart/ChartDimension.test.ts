#! /usr/bin/env jest

// todo: remove this when we remove chartDimension

import { ChartDimension } from "./ChartDimension.js"
import { BlankOwidTable } from "@ourworldindata/core-table"
import { DimensionProperty } from "@ourworldindata/utils"

it("can serialize for saving", () => {
    expect(
        new ChartDimension(
            { property: DimensionProperty.x, variableId: 1 },
            { table: BlankOwidTable() }
        ).toObject()
    ).toEqual({ property: "x", variableId: 1 })
})
