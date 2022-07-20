#! /usr/bin/env jest

import { ColumnTypeNames } from "../../coreTable/CoreColumnDef.js"
import { OwidTable } from "../../coreTable/OwidTable.js"
import { MarkdownTextWrap } from "../text/MarkdownTextWrap.js"
import { DownloadTab } from "./DownloadTab.js"

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

it("correctly passes non-redistributable flag", () => {
    const tableFalse = getTable({ nonRedistributable: false })
    const viewFalse = new DownloadTab({
        manager: {
            staticSVG: "",
            displaySlug: "",
            table: tableFalse,
            detailRenderers: [],
        },
    })
    expect(viewFalse["nonRedistributable"]).toBeFalsy()

    const tableTrue = getTable({ nonRedistributable: true })
    const viewTrue = new DownloadTab({
        manager: {
            staticSVG: "",
            displaySlug: "",
            table: tableTrue,
            detailRenderers: [],
        },
    })
    expect(viewTrue["nonRedistributable"]).toBeTruthy()
})
