import { expect, it } from "vitest"

import { ColumnTypeNames } from "@ourworldindata/types"
import { OwidTable } from "@ourworldindata/core-table"
import {
    CsvDownloadType,
    type DataDownloadContextServerSide,
    getDataDownloadFilename,
    getDownloadSearchParams,
    getNonRedistributableInfo,
} from "./download.js"

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

const makeDownloadContext = (
    overrides: Partial<DataDownloadContextServerSide> = {}
): DataDownloadContextServerSide => ({
    slug: "example-chart",
    searchParams: new URLSearchParams(),
    externalSearchParams: new URLSearchParams(),
    baseUrl: "https://ourworldindata.org/grapher/example-chart",
    csvDownloadType: CsvDownloadType.CurrentSelection,
    shortColNames: false,
    ...overrides,
})

it("getNonRedistributableInfo respects the nonRedistributable flag", () => {
    const tableFalse = getTable({ nonRedistributable: false })
    const info1 = getNonRedistributableInfo(tableFalse)
    expect(info1.cols).toBeUndefined()

    const tableTrue = getTable({ nonRedistributable: true })
    const info2 = getNonRedistributableInfo(tableTrue)
    expect(info2.cols).toHaveLength(1)
})

it("getDataDownloadFilename adds the filtered suffix only for zip downloads", () => {
    expect(
        getDataDownloadFilename({
            slug: "example-chart",
            extension: "zip",
            csvDownloadType: CsvDownloadType.Full,
        })
    ).toBe("example-chart.zip")

    expect(
        getDataDownloadFilename({
            slug: "example-chart",
            extension: "zip",
            csvDownloadType: CsvDownloadType.CurrentSelection,
        })
    ).toBe("example-chart.filtered.zip")

    expect(
        getDataDownloadFilename({
            slug: "example-chart",
            extension: "csv",
            csvDownloadType: CsvDownloadType.CurrentSelection,
        })
    ).toBe("example-chart.csv")
})

it("preserves multidim choices for current-selection downloads", () => {
    const searchParams = getDownloadSearchParams(
        makeDownloadContext({
            searchParams: new URLSearchParams(
                "country=CZK~OWID_WRL&tab=chart&age=all-ages&foo=bar"
            ),
            externalSearchParams: new URLSearchParams("foo=bar"),
        })
    )

    expect(searchParams.get("csvType")).toBe("filtered")
    expect(searchParams.get("country")).toBe("CZK~OWID_WRL")
    expect(searchParams.get("age")).toBe("all-ages")
    expect(searchParams.get("foo")).toBe("bar")
})

it("uses only external search params for full downloads", () => {
    const searchParams = getDownloadSearchParams(
        makeDownloadContext({
            searchParams: new URLSearchParams(
                "country=CZK~OWID_WRL&tab=chart&age=all-ages"
            ),
            externalSearchParams: new URLSearchParams("age=adults&foo=bar"),
            csvDownloadType: CsvDownloadType.Full,
        })
    )

    expect(searchParams.get("csvType")).toBe("full")
    expect(searchParams.get("age")).toBe("adults")
    expect(searchParams.get("foo")).toBe("bar")
    expect(searchParams.get("country")).toBeNull()
    expect(searchParams.get("tab")).toBeNull()
})

it("excludes overlay from current-selection downloads", () => {
    const searchParams = getDownloadSearchParams(
        makeDownloadContext({
            searchParams: new URLSearchParams(
                "country=OWID_WRL&overlay=download-data&tab=chart"
            ),
        })
    )

    expect(searchParams.get("country")).toBe("OWID_WRL")
    expect(searchParams.get("tab")).toBe("chart")
    expect(searchParams.get("overlay")).toBeNull()
})

it("includes fixed download metadata params", () => {
    const searchParams = getDownloadSearchParams(
        makeDownloadContext({
            csvDownloadType: CsvDownloadType.Full,
            shortColNames: true,
        })
    )

    expect(searchParams.get("v")).toBe("1")
    expect(searchParams.get("csvType")).toBe("full")
    expect(searchParams.get("useColumnShortNames")).toBe("true")
})
