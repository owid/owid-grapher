#! /usr/bin/env jest
import { it, describe, expect, test } from "vitest"

// todo: remove this when we remove chartDimension

import { ChartDimension } from "./ChartDimension.js"
import { BlankOwidTable } from "../../coreTable/OwidTable.js"
import { DimensionProperty } from "../../clientUtils/owidTypes.js"

it("can serialize for saving", () => {
    expect(
        new ChartDimension(
            { property: DimensionProperty.x, variableId: 1 },
            { table: BlankOwidTable() }
        ).toObject()
    ).toEqual({ property: "x", variableId: 1 })
})
