import { describe, expect, it } from "vitest"

import {
    ColorSchemeName,
    ColumnTypeNames,
    SortBy,
    SortOrder,
    Time,
} from "@ourworldindata/types"
import { OwidTable } from "@ourworldindata/core-table"
import { convertDateToDaysSinceEpoch, dayjs } from "@ourworldindata/utils"
import { ColorScaleConfig } from "../color/ColorScaleConfig"
import { AxisConfig } from "../axis/AxisConfig"
import { SwimlaneChartState } from "./SwimlaneChartState"
import { SwimlaneSegment, SwimlaneChartManager } from "./SwimlaneChartConstants"

interface Observation {
    entityName: string
    time: Time
    status: string
}

const ICD_REVISIONS = ["ICD-7", "ICD-8", "ICD-9", "ICD-10"]

function makeCategoricalTable(rows: Observation[]): OwidTable {
    return new OwidTable(rows, [
        { slug: "time", type: ColumnTypeNames.Year },
        { slug: "status", type: ColumnTypeNames.String },
    ])
}

function makeOrdinalTable(rows: Observation[]): OwidTable {
    return new OwidTable(rows, [
        { slug: "time", type: ColumnTypeNames.Year },
        { slug: "status", type: ColumnTypeNames.Ordinal, sort: ICD_REVISIONS },
    ])
}

function makeTableWithTimeColumnType(
    timeColumnType: ColumnTypeNames,
    rows: Observation[]
): OwidTable {
    return new OwidTable(rows, [
        { slug: "time", type: timeColumnType },
        { slug: "status", type: ColumnTypeNames.String },
    ])
}

const daysSinceEpoch = (iso: string): number =>
    convertDateToDaysSinceEpoch(dayjs.utc(iso))

function makeChartState(
    table: OwidTable,
    manager: Partial<SwimlaneChartManager> = {}
): SwimlaneChartState {
    return new SwimlaneChartState({
        manager: {
            table,
            selection: table.availableEntityNames,
            yColumnSlugs: ["status"],
            startTime: table.minTime,
            endTime: table.maxTime,
            ...manager,
        },
    })
}

/** Segments of an entity's row without colors and labels */
function findSegments(
    chartState: SwimlaneChartState,
    entityName: string
): Omit<SwimlaneSegment, "color" | "categoryLabel" | "timeRangeLabel">[] {
    const series = chartState.series.find(
        (series) => series.entityName === entityName
    )
    if (!series) throw new Error(`No row for ${entityName}`)
    return series.segments.map((segment) => {
        const { timeRangeLabel: _timeRangeLabel, ...rest } = segment
        if (rest.kind === "missing") return rest
        const {
            color: _color,
            categoryLabel: _categoryLabel,
            ...categoryRest
        } = rest
        return categoryRest
    })
}

describe("segments", () => {
    it("merges consecutive equal categories and starts a new run when the category changes", () => {
        const chartState = makeChartState(
            makeCategoricalTable([
                { entityName: "France", time: 2000, status: "X" },
                { entityName: "France", time: 2001, status: "X" },
                { entityName: "France", time: 2002, status: "Y" },
            ])
        )

        expect(findSegments(chartState, "France")).toEqual([
            {
                kind: "category",
                category: "X",
                startTime: 2000,
                endTime: 2001,
                visibleStartTime: 2000,
                visibleEndTime: 2001,
            },
            {
                kind: "category",
                category: "Y",
                startTime: 2002,
                endTime: 2002,
                visibleStartTime: 2002,
                visibleEndTime: 2002,
            },
        ])
    })

    it("splits a category into two segments around a gap", () => {
        const chartState = makeChartState(
            makeCategoricalTable([
                { entityName: "France", time: 2000, status: "X" },
                { entityName: "France", time: 2002, status: "X" },
            ])
        )

        expect(findSegments(chartState, "France")).toEqual([
            {
                kind: "category",
                category: "X",
                startTime: 2000,
                endTime: 2000,
                visibleStartTime: 2000,
                visibleEndTime: 2000,
            },
            {
                kind: "missing",
                startTime: 2001,
                endTime: 2001,
                visibleStartTime: 2001,
                visibleEndTime: 2001,
            },
            {
                kind: "category",
                category: "X",
                startTime: 2002,
                endTime: 2002,
                visibleStartTime: 2002,
                visibleEndTime: 2002,
            },
        ])
    })

    it("spans the indicator's whole time range, marking times before and after an entity's own data as missing", () => {
        const chartState = makeChartState(
            makeCategoricalTable([
                { entityName: "France", time: 2001, status: "X" },
                { entityName: "Germany", time: 2000, status: "Y" },
                { entityName: "Germany", time: 2003, status: "Y" },
            ])
        )

        // no entity reports 2002, but the row still covers it
        expect(findSegments(chartState, "France")).toEqual([
            {
                kind: "missing",
                startTime: 2000,
                endTime: 2000,
                visibleStartTime: 2000,
                visibleEndTime: 2000,
            },
            {
                kind: "category",
                category: "X",
                startTime: 2001,
                endTime: 2001,
                visibleStartTime: 2001,
                visibleEndTime: 2001,
            },
            {
                kind: "missing",
                startTime: 2002,
                endTime: 2003,
                visibleStartTime: 2002,
                visibleEndTime: 2003,
            },
        ])
    })

    it("treats an empty string as missing", () => {
        const chartState = makeChartState(
            makeCategoricalTable([
                { entityName: "France", time: 2000, status: "X" },
                { entityName: "France", time: 2001, status: "" },
                { entityName: "France", time: 2002, status: "X" },
            ])
        )

        expect(
            findSegments(chartState, "France").map((segment) => segment.kind)
        ).toEqual(["category", "missing", "category"])
    })

    it("clips segments to the timeline window but keeps the full run", () => {
        const chartState = makeChartState(
            makeCategoricalTable([
                { entityName: "France", time: 1999, status: "W" },
                { entityName: "France", time: 2000, status: "X" },
                { entityName: "France", time: 2001, status: "X" },
                { entityName: "France", time: 2002, status: "X" },
                { entityName: "France", time: 2003, status: "Y" },
            ]),
            { startTime: 2001, endTime: 2002 }
        )

        expect(findSegments(chartState, "France")).toEqual([
            {
                kind: "category",
                category: "X",
                startTime: 2000,
                endTime: 2002,
                visibleStartTime: 2001,
                visibleEndTime: 2002,
            },
        ])
    })

    it("steps through months, whatever their length", () => {
        const [jan, feb, mar, apr, may] = [
            "2021-01-01",
            "2021-02-01",
            "2021-03-01",
            "2021-04-01",
            "2021-05-01",
        ].map(daysSinceEpoch)
        const chartState = makeChartState(
            makeTableWithTimeColumnType(ColumnTypeNames.Month, [
                { entityName: "France", time: jan, status: "X" },
                { entityName: "France", time: feb, status: "X" },
                { entityName: "France", time: apr, status: "X" },
                { entityName: "France", time: may, status: "Y" },
            ])
        )

        expect(findSegments(chartState, "France")).toEqual([
            {
                kind: "category",
                category: "X",
                startTime: jan,
                endTime: feb,
                visibleStartTime: jan,
                visibleEndTime: feb,
            },
            {
                kind: "missing",
                startTime: mar,
                endTime: mar,
                visibleStartTime: mar,
                visibleEndTime: mar,
            },
            {
                kind: "category",
                category: "X",
                startTime: apr,
                endTime: apr,
                visibleStartTime: apr,
                visibleEndTime: apr,
            },
            {
                kind: "category",
                category: "Y",
                startTime: may,
                endTime: may,
                visibleStartTime: may,
                visibleEndTime: may,
            },
        ])
    })
})

describe("x axis", () => {
    const [jan, feb, mar] = ["2021-01-01", "2021-02-01", "2021-03-01"].map(
        daysSinceEpoch
    )

    it.each([
        {
            name: "years",
            type: ColumnTypeNames.Year,
            times: [2000, 2010],
            domain: [2000, 2011],
        },
        {
            name: "a single year",
            type: ColumnTypeNames.Year,
            times: [2004],
            domain: [2004, 2005],
        },
        {
            name: "months",
            type: ColumnTypeNames.Month,
            times: [jan, feb],
            domain: [jan, mar],
        },
        {
            name: "decades",
            type: ColumnTypeNames.Decade,
            times: [1950, 1960],
            domain: [1950, 1970],
        },
    ])(
        "ends one period past the last time, for $name",
        ({ type, times, domain }) => {
            const chartState = makeChartState(
                makeTableWithTimeColumnType(
                    type,
                    times.map((time) => ({
                        entityName: "France",
                        time,
                        status: "X",
                    }))
                )
            )

            expect(chartState.visibleTimeRange).toEqual({
                startTime: domain[0],
                endTime: times.at(-1),
                exclusiveEndTime: domain[1],
            })
            expect(
                chartState.toHorizontalAxis(new AxisConfig()).domain
            ).toEqual(domain)
        }
    )
})

describe("category label", () => {
    it("is the custom label the legend shows, or the category itself", () => {
        const chartState = makeChartState(
            makeCategoricalTable([
                { entityName: "France", time: 2000, status: "Neoplasms" },
                { entityName: "France", time: 2001, status: "Malaria" },
            ]),
            {
                colorScale: new ColorScaleConfig({
                    customCategoryLabels: { Neoplasms: "Cancer" },
                }),
            }
        )
        const france = chartState.series.find(
            (series) => series.entityName === "France"
        )

        expect(
            france?.segments.map((segment) =>
                segment.kind === "category" ? segment.categoryLabel : undefined
            )
        ).toEqual(["Cancer", "Malaria"])
    })
})

describe("row color", () => {
    it("is the color of the last category, even when missing data trails it", () => {
        const chartState = makeChartState(
            makeCategoricalTable([
                { entityName: "France", time: 2000, status: "X" },
                { entityName: "France", time: 2001, status: "Y" },
                { entityName: "Germany", time: 2002, status: "X" },
            ])
        )
        const { colorScale } = chartState
        const france = chartState.series.find(
            (series) => series.entityName === "France"
        )

        expect(colorScale.getColor("X")).not.toEqual(colorScale.getColor("Y"))
        expect(france?.color).toEqual(colorScale.getColor("Y"))
    })

    it("is the no-data color for a selected entity without data, whose row is one missing segment", () => {
        const chartState = makeChartState(
            makeCategoricalTable([
                { entityName: "France", time: 2000, status: "X" },
                { entityName: "France", time: 2001, status: "Y" },
            ]),
            { selection: ["France", "Spain"] }
        )
        const spain = chartState.series.find(
            (series) => series.entityName === "Spain"
        )

        expect(spain?.color).toEqual(chartState.colorScale.noDataColor)
        expect(findSegments(chartState, "Spain")).toEqual([
            {
                kind: "missing",
                startTime: 2000,
                endTime: 2001,
                visibleStartTime: 2000,
                visibleEndTime: 2001,
            },
        ])
    })
})

describe("categories", () => {
    it("are ordinal when the indicator defines a sort order", () => {
        const chartState = makeChartState(
            makeOrdinalTable([
                { entityName: "France", time: 2000, status: "ICD-10" },
                { entityName: "France", time: 2001, status: "ICD-7" },
                { entityName: "France", time: 2002, status: "ICD-9" },
            ])
        )

        expect(chartState.categoryKind).toEqual("ordinal")
        expect(chartState.defaultBaseColorScheme).toEqual(
            ColorSchemeName.SingleColorGradientDenim
        )
    })

    it("are categorical for a plain string indicator", () => {
        const chartState = makeChartState(
            makeCategoricalTable([
                { entityName: "France", time: 2000, status: "Y" },
                { entityName: "France", time: 2001, status: "X" },
            ])
        )

        expect(chartState.categoryKind).toEqual("categorical")
        expect(chartState.defaultBaseColorScheme).toEqual(
            ColorSchemeName.OwidCategoricalA
        )
    })
})

describe("errorInfo", () => {
    it("has no reason for a single categorical indicator", () => {
        const chartState = makeChartState(
            makeCategoricalTable([
                { entityName: "France", time: 2000, status: "X" },
            ])
        )

        expect(chartState.errorInfo.reason).toEqual("")
    })

    it("reports no data when no selected entity has a category, but not when one does", () => {
        const table = makeCategoricalTable([
            { entityName: "France", time: 2000, status: "X" },
        ])
        const withoutData = makeChartState(table, {
            selection: ["Spain", "Italy"],
            entityTypePlural: "countries",
        })
        const withSomeData = makeChartState(table, {
            selection: ["Spain", "France"],
        })

        expect(withoutData.errorInfo.reason).toEqual(
            "No data for the selected countries"
        )
        expect(withSomeData.errorInfo.reason).toEqual("")
    })

    it("refuses a numeric indicator", () => {
        const table = new OwidTable(
            [{ entityName: "France", time: 2000, value: 42 }],
            [{ slug: "value", type: ColumnTypeNames.Numeric }]
        )
        const chartState = makeChartState(table, { yColumnSlugs: ["value"] })

        expect(chartState.errorInfo.reason).toEqual(
            "Requires an indicator with categorical values"
        )
    })

    it("refuses more than one indicator", () => {
        const table = new OwidTable(
            [{ entityName: "France", time: 2000, status: "X", region: "EU" }],
            [
                { slug: "status", type: ColumnTypeNames.String },
                { slug: "region", type: ColumnTypeNames.String },
            ]
        )
        const chartState = makeChartState(table, {
            yColumnSlugs: ["status", "region"],
        })

        expect(chartState.errorInfo.reason).toEqual(
            "Only one indicator can be shown at a time"
        )
    })
})

describe("rows", () => {
    const table = makeCategoricalTable([
        { entityName: "France", time: 2000, status: "X" },
        { entityName: "Germany", time: 2000, status: "X" },
        { entityName: "Italy", time: 2000, status: "X" },
        { entityName: "Spain", time: 2000, status: "X" },
    ])
    const selection = ["Spain", "France", "Germany"]

    function findRowNames(sortBy: SortBy, sortOrder: SortOrder): string[] {
        const chartState = makeChartState(table, {
            selection,
            sortConfig: { sortBy, sortOrder },
        })
        return chartState.series.map((series) => series.entityName)
    }

    it("are the selected entities only, sorted by name", () => {
        expect(findRowNames(SortBy.entityName, SortOrder.asc)).toEqual([
            "France",
            "Germany",
            "Spain",
        ])
    })

    it("follow the selection order when sorted by custom order, reversed when descending", () => {
        expect(findRowNames(SortBy.custom, SortOrder.asc)).toEqual([
            "Spain",
            "France",
            "Germany",
        ])
        expect(findRowNames(SortBy.custom, SortOrder.desc)).toEqual([
            "Germany",
            "France",
            "Spain",
        ])
    })

    it("fall back to sorting by name, ascending, for a sort key swimlanes don't support", () => {
        expect(findRowNames(SortBy.total, SortOrder.desc)).toEqual([
            "France",
            "Germany",
            "Spain",
        ])
    })
})
