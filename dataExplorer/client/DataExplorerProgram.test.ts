#! /usr/bin/env yarn jest

import { DataExplorerProgram } from "dataExplorer/client/DataExplorerProgram"

describe(DataExplorerProgram, () => {
    const program = new DataExplorerProgram(
        "test",
        DataExplorerProgram.defaultExplorerProgram
    )
    it("gets the required chart ids", () => {
        expect(program.requiredChartIds).toEqual([35, 46])
    })

    it("gets code", () => {
        const expected = `chartId\tDevice
35\tInternet
46\tMobile`
        expect(program.switcherCode).toEqual(expected)
    })
})
