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
import { HorizontalAxis } from "../axis/Axis"
import { SwimlaneChartState } from "./SwimlaneChartState"
import {
    SwimlaneSegment,
    SWIMLANE_X_AXIS_CONFIG_DEFAULTS,
    SwimlaneChartManager,
} from "./SwimlaneChartConstants"

interface Observation {
    entityName: string
    time: Time
    status: string
}

const ICD_REVISIONS = ["ICD-7", "ICD-8", "ICD-9", "ICD-10"]

function makeCategoricalTable(rows: Observation[]): OwidTable {
    return new OwidTable(rows, [
        { slug: "status", type: ColumnTypeNames.String },
    ])
}

function makeOrdinalTable(rows: Observation[]): OwidTable {
    return new OwidTable(rows, [
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

function makeChartState(
    table: OwidTable,
    manager: Partial<SwimlaneChartManager> = {}
): SwimlaneChartState {
    return new SwimlaneChartState({
        manager: {
            table,
            selection: table.availableEntityNames,
            yColumnSlugs: ["status"],
            ...manager,
        },
    })
}

/** Segments of an entity's lane without colors and category labels */
function findSegments(
    chartState: SwimlaneChartState,
    entityName: string
): Omit<SwimlaneSegment, "color" | "categoryLabel">[] {
    const series = chartState.series.find(
        (series) => series.entityName === entityName
    )
    if (!series) throw new Error(`No lane for ${entityName}`)
    return series.segments.map((segment) => {
        if (segment.kind === "missing") return segment
        const {
            color: _color,
            categoryLabel: _categoryLabel,
            ...rest
        } = segment
        return rest
    })
}

describe("segments", () => {
    it("merges consecutive equal categories and marks times only other entities report as missing", () => {
        const chartState = makeChartState(
            makeCategoricalTable([
                { entityName: "France", time: 2000, status: "X" },
                { entityName: "France", time: 2001, status: "X" },
                { entityName: "France", time: 2002, status: "Y" },
                { entityName: "Germany", time: 2003, status: "X" },
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
            {
                kind: "missing",
                startTime: 2003,
                endTime: 2003,
                visibleStartTime: 2003,
                visibleEndTime: 2003,
            },
        ])
    })

    it("splits a category into two runs around a gap", () => {
        const chartState = makeChartState(
            makeCategoricalTable([
                { entityName: "France", time: 2000, status: "X" },
                { entityName: "France", time: 2002, status: "X" },
                { entityName: "Germany", time: 2001, status: "Z" },
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

    it("marks every year without an observation as missing, even when no entity reports it", () => {
        const chartState = makeChartState(
            makeCategoricalTable([
                { entityName: "France", time: 2000, status: "X" },
                { entityName: "France", time: 2010, status: "X" },
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
                endTime: 2009,
                visibleStartTime: 2001,
                visibleEndTime: 2009,
            },
            {
                kind: "category",
                category: "X",
                startTime: 2010,
                endTime: 2010,
                visibleStartTime: 2010,
                visibleEndTime: 2010,
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
})

describe("segments across time intervals", () => {
    const daysSinceEpoch = (iso: string): number =>
        convertDateToDaysSinceEpoch(dayjs.utc(iso))

    it("merges consecutive months, whatever their length", () => {
        const [jan, feb, mar, apr] = [
            "2021-01-01",
            "2021-02-01",
            "2021-03-01",
            "2021-04-01",
        ].map(daysSinceEpoch)
        const chartState = makeChartState(
            makeTableWithTimeColumnType(ColumnTypeNames.Month, [
                { entityName: "France", time: jan, status: "X" },
                { entityName: "France", time: feb, status: "X" },
                { entityName: "France", time: mar, status: "X" },
                { entityName: "France", time: apr, status: "Y" },
            ])
        )

        expect(findSegments(chartState, "France")).toEqual([
            {
                kind: "category",
                category: "X",
                startTime: jan,
                endTime: mar,
                visibleStartTime: jan,
                visibleEndTime: mar,
            },
            {
                kind: "category",
                category: "Y",
                startTime: apr,
                endTime: apr,
                visibleStartTime: apr,
                visibleEndTime: apr,
            },
        ])
    })

    it("merges consecutive weeks", () => {
        const [week1, week2, week3] = [
            "2021-01-04",
            "2021-01-11",
            "2021-01-18",
        ].map(daysSinceEpoch)
        const chartState = makeChartState(
            makeTableWithTimeColumnType(ColumnTypeNames.Week, [
                { entityName: "France", time: week1, status: "X" },
                { entityName: "France", time: week2, status: "X" },
                { entityName: "France", time: week3, status: "X" },
            ])
        )

        expect(findSegments(chartState, "France")).toHaveLength(1)
    })

    it("merges consecutive decades", () => {
        const chartState = makeChartState(
            makeTableWithTimeColumnType(ColumnTypeNames.Decade, [
                { entityName: "France", time: 1950, status: "X" },
                { entityName: "France", time: 1960, status: "X" },
                { entityName: "France", time: 1970, status: "Y" },
            ])
        )

        expect(findSegments(chartState, "France")).toEqual([
            {
                kind: "category",
                category: "X",
                startTime: 1950,
                endTime: 1960,
                visibleStartTime: 1950,
                visibleEndTime: 1960,
            },
            {
                kind: "category",
                category: "Y",
                startTime: 1970,
                endTime: 1970,
                visibleStartTime: 1970,
                visibleEndTime: 1970,
            },
        ])
    })

    it("marks a skipped period as missing", () => {
        const [jan, feb, mar] = ["2021-01-01", "2021-02-01", "2021-03-01"].map(
            daysSinceEpoch
        )
        const chartState = makeChartState(
            makeTableWithTimeColumnType(ColumnTypeNames.Month, [
                { entityName: "France", time: jan, status: "X" },
                { entityName: "France", time: mar, status: "X" },
                { entityName: "Germany", time: feb, status: "X" },
            ])
        )

        expect(
            findSegments(chartState, "France").map((segment) => segment.kind)
        ).toEqual(["category", "missing", "category"])
    })
})

describe("x axis", () => {
    function makeAxis(table: OwidTable): HorizontalAxis {
        const axis = makeChartState(table).toHorizontalAxis(
            new AxisConfig(SWIMLANE_X_AXIS_CONFIG_DEFAULTS)
        )
        axis.range = [0, 500]
        return axis
    }

    it("ends one step past the last time, without a tick there", () => {
        const axis = makeAxis(
            makeCategoricalTable([
                { entityName: "France", time: 2000, status: "X" },
                { entityName: "France", time: 2010, status: "Y" },
            ])
        )

        expect(axis.domain).toEqual([2000, 2011])
        expect(axis.tickLabels.map((label) => label.value)).toContain(2010)
        expect(Math.max(...axis.tickLabels.map((label) => label.value))).toBe(
            2010
        )
    })

    it("spans a single step when the window holds a single time", () => {
        const axis = makeAxis(
            makeCategoricalTable([
                { entityName: "France", time: 2004, status: "X" },
            ])
        )

        expect(axis.domain).toEqual([2004, 2005])
    })
})

describe("x axis across time intervals", () => {
    const daysSinceEpoch = (iso: string): number =>
        convertDateToDaysSinceEpoch(dayjs.utc(iso))

    it("ends one month past the last month, which has its own length", () => {
        const chartState = makeChartState(
            makeTableWithTimeColumnType(ColumnTypeNames.Month, [
                {
                    entityName: "France",
                    time: daysSinceEpoch("2021-01-01"),
                    status: "X",
                },
                {
                    entityName: "France",
                    time: daysSinceEpoch("2021-02-01"),
                    status: "Y",
                },
            ])
        )

        expect(chartState.visiblePeriodsEndTime).toEqual(
            daysSinceEpoch("2021-03-01")
        )
        expect(chartState.toHorizontalAxis(new AxisConfig()).domain).toEqual([
            daysSinceEpoch("2021-01-01"),
            daysSinceEpoch("2021-03-01"),
        ])
    })

    it("labels no month past the last one", () => {
        const [jan, feb, mar] = ["2021-01-01", "2021-02-01", "2021-03-01"].map(
            daysSinceEpoch
        )
        const axis = makeChartState(
            makeTableWithTimeColumnType(ColumnTypeNames.Month, [
                { entityName: "France", time: jan, status: "X" },
                { entityName: "France", time: feb, status: "Y" },
            ])
        ).toHorizontalAxis(new AxisConfig(SWIMLANE_X_AXIS_CONFIG_DEFAULTS))
        axis.range = [0, 500]

        const tickValues = axis.tickLabels.map((label) => label.value)
        expect(tickValues).toContain(feb)
        expect(tickValues).not.toContain(mar)
    })

    it("ends one decade past the last decade", () => {
        const chartState = makeChartState(
            makeTableWithTimeColumnType(ColumnTypeNames.Decade, [
                { entityName: "France", time: 1950, status: "X" },
                { entityName: "France", time: 1960, status: "Y" },
            ])
        )

        expect(chartState.toHorizontalAxis(new AxisConfig()).domain).toEqual([
            1950, 1970,
        ])
    })
})

describe("decade x axis", () => {
    it("labels each tick with its own decade", () => {
        const chartState = makeChartState(
            makeTableWithTimeColumnType(ColumnTypeNames.Decade, [
                { entityName: "France", time: 1950, status: "X" },
                { entityName: "France", time: 1960, status: "Y" },
                { entityName: "France", time: 1970, status: "X" },
                { entityName: "France", time: 1980, status: "Y" },
            ])
        )
        const axis = chartState.toHorizontalAxis(
            new AxisConfig(SWIMLANE_X_AXIS_CONFIG_DEFAULTS)
        )
        axis.range = [0, 600]

        expect(axis.tickLabels.map((label) => label.formattedValue)).toEqual([
            "1950s",
            "1960s",
            "1970s",
            "1980s",
        ])
    })
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

describe("lane color", () => {
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

    it("is the no-data color for a selected entity without data, whose lane is one missing segment", () => {
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
    it("are ordinal when the indicator defines a sort order, listing every allowed value in that order", () => {
        const chartState = makeChartState(
            makeOrdinalTable([
                { entityName: "France", time: 2000, status: "ICD-10" },
                { entityName: "France", time: 2001, status: "ICD-7" },
                { entityName: "France", time: 2002, status: "ICD-9" },
            ])
        )

        expect(chartState.categories).toEqual({
            kind: "ordinal",
            values: ["ICD-7", "ICD-8", "ICD-9", "ICD-10"],
        })
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

        expect(chartState.categories?.kind).toEqual("categorical")
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

describe("lanes", () => {
    const table = makeCategoricalTable([
        { entityName: "France", time: 2000, status: "X" },
        { entityName: "Germany", time: 2000, status: "X" },
        { entityName: "Italy", time: 2000, status: "X" },
        { entityName: "Spain", time: 2000, status: "X" },
    ])
    const selection = ["Spain", "France", "Germany"]

    function findLaneNames(sortBy: SortBy, sortOrder: SortOrder): string[] {
        const chartState = makeChartState(table, {
            selection,
            sortConfig: { sortBy, sortOrder },
        })
        return chartState.series.map((series) => series.entityName)
    }

    it("are the selected entities only, sorted by name", () => {
        expect(findLaneNames(SortBy.entityName, SortOrder.asc)).toEqual([
            "France",
            "Germany",
            "Spain",
        ])
    })

    it("follow the selection order when sorted by custom order, reversed when descending", () => {
        expect(findLaneNames(SortBy.custom, SortOrder.asc)).toEqual([
            "Spain",
            "France",
            "Germany",
        ])
        expect(findLaneNames(SortBy.custom, SortOrder.desc)).toEqual([
            "Germany",
            "France",
            "Spain",
        ])
    })

    it("fall back to sorting by name, ascending, for a sort key swimlanes don't support", () => {
        expect(findLaneNames(SortBy.total, SortOrder.desc)).toEqual([
            "France",
            "Germany",
            "Spain",
        ])
    })
})
