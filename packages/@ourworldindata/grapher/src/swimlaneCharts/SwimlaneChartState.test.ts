import { describe, expect, it } from "vitest"

import { ColorSchemeName, ColumnTypeNames, Time } from "@ourworldindata/types"
import { OwidTable } from "@ourworldindata/core-table"
import { SwimlaneChartState } from "./SwimlaneChartState"
import {
    ColoredSwimlaneSegment,
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

/** Segments of an entity's lane without colors */
function findSegments(
    chartState: SwimlaneChartState,
    entityName: string
): Omit<ColoredSwimlaneSegment, "color">[] {
    const series = chartState.series.find(
        (series) => series.entityName === entityName
    )
    if (!series) throw new Error(`No lane for ${entityName}`)
    return series.segments.map((segment) => {
        if (segment.kind === "missing") return segment
        const { color: _color, ...rest } = segment
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
            },
            {
                kind: "category",
                category: "Y",
                startTime: 2002,
                endTime: 2002,
            },
            { kind: "missing", startTime: 2003, endTime: 2003 },
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
            },
            { kind: "missing", startTime: 2001, endTime: 2001 },
            {
                kind: "category",
                category: "X",
                startTime: 2002,
                endTime: 2002,
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
            },
            { kind: "missing", startTime: 2001, endTime: 2009 },
            {
                kind: "category",
                category: "X",
                startTime: 2010,
                endTime: 2010,
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
            { kind: "missing", startTime: 2000, endTime: 2001 },
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
