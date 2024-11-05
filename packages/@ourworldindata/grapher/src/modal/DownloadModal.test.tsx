#! /usr/bin/env jest

import { ColumnTypeNames } from "@ourworldindata/types"
import { OwidTable } from "@ourworldindata/core-table"
import { getNonRedistributableInfo } from "./DownloadModal"

const getTable = (options: { nonRedistributable: boolean }): OwidTable => {
    return new OwidTable(
        [
            ["entityName", "year", "x", "y"],
            ["usa", 1998, 1, 1],
            ["uk", 1999, 0, 0],
            ["uk", 2000, 0, 0],
            ["uk", 2001, 0, 0],
            ["usa", 2002, 2, 2],
        ],
        [
            {
                slug: "x",
                type: ColumnTypeNames.Numeric,
                tolerance: 1,
                nonRedistributable: options.nonRedistributable,
            },
            {
                slug: "y",
                type: ColumnTypeNames.Numeric,
                tolerance: 1,
            },
        ]
    )
}

it("correctly works with non-redistributable flag", () => {
    const tableFalse = getTable({ nonRedistributable: false })
    const info1 = getNonRedistributableInfo(tableFalse)
    expect(info1.cols).toBeUndefined()

    const tableTrue = getTable({ nonRedistributable: true })
    const info2 = getNonRedistributableInfo(tableTrue)
    expect(info2.cols).toHaveLength(1)
})
