import { expect, it, describe } from "vitest"

import {
    ColumnTypeNames,
    FacetStrategy,
    SortBy,
    SortOrder,
    SwimlaneSegmentLabels,
} from "@ourworldindata/types"
import { OwidTable } from "@ourworldindata/core-table"
import { ColorScaleConfig } from "../color/ColorScaleConfig"
import { SwimlaneChartState } from "./SwimlaneChartState"
import { SwimlaneChartManager } from "./SwimlaneChartConstants"

interface CauseRow {
    entityName: string
    time: number
    cause: string
}

const ICD_SORT = ["ICD-7", "ICD-8", "ICD-9", "ICD-10"]

function ordinalTable(rows: CauseRow[]): OwidTable {
    return new OwidTable(rows, [
        { slug: "cause", type: ColumnTypeNames.Ordinal, sort: ICD_SORT },
    ])
}

describe("errorInfo", () => {
    it("refuses when nothing is selected", () => {
        const table = ordinalTable([
            { entityName: "France", time: 2000, cause: "ICD-9" },
        ])
        const manager: SwimlaneChartManager = {
            table,
            entityType: "country",
            selection: [],
            yColumnSlugs: ["cause"],
        }
        const chartState = new SwimlaneChartState({ manager })

        expect(chartState.errorInfo.reason).toEqual("No country selected")
    })

    it("refuses more than one y indicator", () => {
        const table = new OwidTable(
            [
                {
                    entityName: "France",
                    time: 2000,
                    cause: "ICD-9",
                    grouping: "Europe",
                },
            ],
            [
                {
                    slug: "cause",
                    type: ColumnTypeNames.Ordinal,
                    sort: ICD_SORT,
                },
                { slug: "grouping", type: ColumnTypeNames.String },
            ]
        )
        const manager: SwimlaneChartManager = {
            table,
            selection: ["France"],
            yColumnSlugs: ["cause", "grouping"],
        }
        const chartState = new SwimlaneChartState({ manager })

        expect(chartState.errorInfo.reason).toEqual(
            "Only one indicator can be shown at a time"
        )
    })

    it("refuses a numeric y column", () => {
        const table = new OwidTable([
            { entityName: "France", time: 2000, value: 42 },
        ])
        const manager: SwimlaneChartManager = {
            table,
            selection: ["France"],
            yColumnSlugs: ["value"],
        }
        const chartState = new SwimlaneChartState({ manager })

        expect(chartState.errorInfo.reason).toEqual(
            "Requires an indicator with categorical values"
        )
    })
})

describe("availableFacetStrategies", () => {
    it("offers no facets, whatever the column and however many entities", () => {
        const table = ordinalTable([
            { entityName: "France", time: 2000, cause: "ICD-9" },
            { entityName: "Germany", time: 2000, cause: "ICD-8" },
        ])
        const manager: SwimlaneChartManager = {
            table,
            selection: ["France", "Germany"],
            yColumnSlugs: ["cause"],
        }
        const chartState = new SwimlaneChartState({ manager })

        expect(chartState.availableFacetStrategies).toEqual([
            FacetStrategy.none,
        ])
    })
})

describe("categories", () => {
    it("takes ordinal categories from the column's declared sort, not alphabetically", () => {
        const table = ordinalTable([
            { entityName: "France", time: 2000, cause: "ICD-9" },
            { entityName: "France", time: 2001, cause: "ICD-8" },
        ])
        const manager: SwimlaneChartManager = {
            table,
            selection: ["France"],
            yColumnSlugs: ["cause"],
        }
        const chartState = new SwimlaneChartState({ manager })

        expect(chartState.categories).toEqual({
            kind: "ordinal",
            values: ICD_SORT,
        })
        expect([...ICD_SORT].sort()).not.toEqual(ICD_SORT)
    })

    it("sorts a plain string column's categories alphabetically", () => {
        const table = new OwidTable([
            { entityName: "France", time: 2000, grouping: "Europe" },
            { entityName: "Nigeria", time: 2000, grouping: "Africa" },
            { entityName: "Japan", time: 2000, grouping: "Asia" },
        ])
        const manager: SwimlaneChartManager = {
            table,
            selection: ["France", "Nigeria", "Japan"],
            yColumnSlugs: ["grouping"],
        }
        const chartState = new SwimlaneChartState({ manager })

        expect(chartState.categories).toEqual({
            kind: "categorical",
            values: ["Africa", "Asia", "Europe"],
        })
    })
})

describe("series", () => {
    it("colors a category's segments with its custom category color", () => {
        const table = ordinalTable([
            { entityName: "France", time: 2000, cause: "ICD-9" },
        ])
        const manager: SwimlaneChartManager = {
            table,
            selection: ["France"],
            yColumnSlugs: ["cause"],
            colorScale: new ColorScaleConfig({
                customCategoryColors: { "ICD-9": "#123456" },
            }),
        }
        const chartState = new SwimlaneChartState({ manager })

        const segment = chartState.series[0].segments[0]
        expect(segment.kind).toEqual("category")
        expect(segment).toMatchObject({ category: "ICD-9", color: "#123456" })
    })

    it("comes back in selection order under custom sort", () => {
        const table = ordinalTable([
            { entityName: "France", time: 2000, cause: "ICD-9" },
            { entityName: "Zimbabwe", time: 2000, cause: "ICD-8" },
            { entityName: "Albania", time: 2000, cause: "ICD-7" },
        ])
        const manager: SwimlaneChartManager = {
            table,
            selection: ["France", "Zimbabwe", "Albania"],
            yColumnSlugs: ["cause"],
            sortConfig: { sortBy: SortBy.custom, sortOrder: SortOrder.asc },
        }
        const chartState = new SwimlaneChartState({ manager })

        expect(chartState.series.map((series) => series.seriesName)).toEqual([
            "France",
            "Zimbabwe",
            "Albania",
        ])
    })

    it("keeps the same category on either side of a hole as two segments, not one", () => {
        const table = ordinalTable([
            { entityName: "France", time: 2000, cause: "ICD-9" },
            { entityName: "France", time: 2001, cause: "ICD-9" },
            { entityName: "France", time: 2003, cause: "ICD-9" },
            {
                entityName: "EntityPresentOnlyIn2002",
                time: 2002,
                cause: "ICD-7",
            },
        ])
        const manager: SwimlaneChartManager = {
            table,
            selection: ["France"],
            yColumnSlugs: ["cause"],
        }
        const chartState = new SwimlaneChartState({ manager })

        const segments = chartState.series[0].segments
        expect(segments.map((segment) => segment.kind)).toEqual([
            "category",
            "missing",
            "category",
        ])
        expect(segments[0]).toMatchObject({
            category: "ICD-9",
            startTime: 2000,
            endTime: 2001,
        })
        expect(segments[2]).toMatchObject({
            category: "ICD-9",
            startTime: 2003,
            endTime: 2003,
        })
    })

    it("leaves a hole alone when the column declares a tolerance", () => {
        const table = new OwidTable(
            [
                { entityName: "France", time: 2000, cause: "ICD-9" },
                { entityName: "France", time: 2002, cause: "ICD-9" },
                {
                    entityName: "EntityPresentOnlyIn2001",
                    time: 2001,
                    cause: "ICD-7",
                },
            ],
            [
                {
                    slug: "cause",
                    type: ColumnTypeNames.Ordinal,
                    sort: ICD_SORT,
                    display: { tolerance: 1 },
                },
            ]
        )
        const manager: SwimlaneChartManager = {
            table,
            selection: ["France"],
            yColumnSlugs: ["cause"],
        }
        const chartState = new SwimlaneChartState({ manager })

        expect(
            chartState.series[0].segments.map((segment) => segment.kind)
        ).toEqual(["category", "missing", "category"])
    })
})

describe("lane order", () => {
    const table = ordinalTable([
        { entityName: "France", time: 2000, cause: "ICD-9" },
        { entityName: "Albania", time: 2000, cause: "ICD-7" },
        { entityName: "Zimbabwe", time: 2000, cause: "ICD-8" },
    ])
    const manager: SwimlaneChartManager = {
        table,
        selection: ["France", "Albania", "Zimbabwe"],
        yColumnSlugs: ["cause"],
    }

    function toLaneOrder(chartState: SwimlaneChartState): string[] {
        return chartState.series.map((series) => series.seriesName)
    }

    it("defaults to entityName, descending", () => {
        const chartState = new SwimlaneChartState({ manager })

        expect(chartState.sortConfig.sortBy).toEqual(SortBy.entityName)
        expect(toLaneOrder(chartState)).toEqual([
            "Zimbabwe",
            "France",
            "Albania",
        ])
    })

    it("sortOrder asc reverses the order", () => {
        const chartState = new SwimlaneChartState({
            manager: {
                ...manager,
                sortConfig: {
                    sortBy: SortBy.entityName,
                    sortOrder: SortOrder.asc,
                },
            },
        })

        expect(toLaneOrder(chartState)).toEqual([
            "Albania",
            "France",
            "Zimbabwe",
        ])
    })

    it("custom keeps the selection order, reversed under desc", () => {
        const chartState = new SwimlaneChartState({
            manager: { ...manager, sortConfig: { sortBy: SortBy.custom } },
        })

        expect(toLaneOrder(chartState)).toEqual([
            "Zimbabwe",
            "Albania",
            "France",
        ])
    })

    it("falls back to entityName when the configured sort key is another chart type's", () => {
        const chartState = new SwimlaneChartState({
            manager: { ...manager, sortConfig: { sortBy: SortBy.change } },
        })

        expect(chartState.sortConfig.sortBy).toEqual(SortBy.entityName)
        expect(toLaneOrder(chartState)).toEqual([
            "Zimbabwe",
            "France",
            "Albania",
        ])
    })
})

describe("segmentLabels", () => {
    const table = ordinalTable([
        { entityName: "France", time: 2000, cause: "ICD-9" },
    ])
    const manager: SwimlaneChartManager = {
        table,
        selection: ["France"],
        yColumnSlugs: ["cause"],
    }

    it("labels a segment with its category and time range by default", () => {
        const chartState = new SwimlaneChartState({ manager })

        expect(chartState.segmentLabels).toEqual(
            SwimlaneSegmentLabels.CategoryAndTimeRange
        )
    })

    it("honours the author's choice to label nothing", () => {
        const chartState = new SwimlaneChartState({
            manager: {
                ...manager,
                swimlane: { segmentLabels: SwimlaneSegmentLabels.None },
            },
        })

        expect(chartState.segmentLabels).toEqual(SwimlaneSegmentLabels.None)
    })
})
