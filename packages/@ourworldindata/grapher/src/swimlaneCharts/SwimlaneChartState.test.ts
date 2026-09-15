import { expect, it, describe } from "vitest"

import { ColumnTypeNames, SortBy, SortOrder } from "@ourworldindata/types"
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
})

describe("lane order", () => {
    it("defaults to lastCategory, highest-ranked final category first", () => {
        const table = ordinalTable([
            { entityName: "France", time: 2000, cause: "ICD-7" },
            { entityName: "Germany", time: 2000, cause: "ICD-9" },
            { entityName: "Japan", time: 2000, cause: "ICD-10" },
        ])
        const manager: SwimlaneChartManager = {
            table,
            selection: ["France", "Germany", "Japan"],
            yColumnSlugs: ["cause"],
        }
        const chartState = new SwimlaneChartState({ manager })

        expect(chartState.series.map((series) => series.seriesName)).toEqual([
            "Japan",
            "Germany",
            "France",
        ])
    })

    it("breaks a final-category tie by how long that category has run, longest first", () => {
        const table = ordinalTable([
            { entityName: "LongRun", time: 2000, cause: "ICD-9" },
            { entityName: "LongRun", time: 2001, cause: "ICD-9" },
            { entityName: "LongRun", time: 2002, cause: "ICD-9" },
            { entityName: "ShortRun", time: 2000, cause: "ICD-7" },
            { entityName: "ShortRun", time: 2001, cause: "ICD-7" },
            { entityName: "ShortRun", time: 2002, cause: "ICD-9" },
        ])
        const manager: SwimlaneChartManager = {
            table,
            selection: ["ShortRun", "LongRun"],
            yColumnSlugs: ["cause"],
        }

        const chartState = new SwimlaneChartState({ manager })

        expect(chartState.series.map((series) => series.seriesName)).toEqual([
            "LongRun",
            "ShortRun",
        ])
    })

    it("breaks a same-category, same-duration tie by entity name", () => {
        const table = ordinalTable([
            { entityName: "Bravo", time: 2000, cause: "ICD-9" },
            { entityName: "Alpha", time: 2000, cause: "ICD-9" },
        ])
        const chartState = new SwimlaneChartState({
            manager: {
                table,
                selection: ["Bravo", "Alpha"],
                yColumnSlugs: ["cause"],
            },
        })

        expect(chartState.series.map((series) => series.seriesName)).toEqual([
            "Bravo",
            "Alpha",
        ])
    })

    it("keys on the last category even when a trailing gap follows it", () => {
        // Every row trails off before the column's last time, as on chart 9260
        const table = ordinalTable([
            { entityName: "LongIcd10", time: 2000, cause: "ICD-9" },
            { entityName: "LongIcd10", time: 2001, cause: "ICD-10" },
            { entityName: "LongIcd10", time: 2002, cause: "ICD-10" },
            { entityName: "ShortIcd10", time: 2000, cause: "ICD-9" },
            { entityName: "ShortIcd10", time: 2001, cause: "ICD-9" },
            { entityName: "ShortIcd10", time: 2002, cause: "ICD-10" },
            { entityName: "StoppedOnIcd9", time: 2000, cause: "ICD-9" },
            { entityName: "Anyone", time: 2003, cause: "ICD-7" },
        ])
        const chartState = new SwimlaneChartState({
            manager: {
                table,
                selection: [
                    "ShortIcd10",
                    "StoppedOnIcd9",
                    "Empty",
                    "LongIcd10",
                ],
                yColumnSlugs: ["cause"],
            },
        })

        expect(chartState.series[0].segments.at(-1)?.kind).toEqual("missing")
        expect(chartState.series.map((series) => series.seriesName)).toEqual([
            "LongIcd10",
            "ShortIcd10",
            "StoppedOnIcd9",
            "Empty",
        ])
    })

    it("reverses the whole order under asc, no-data row included", () => {
        const table = ordinalTable([
            { entityName: "Long", time: 2001, cause: "ICD-10" },
            { entityName: "Long", time: 2002, cause: "ICD-10" },
            { entityName: "Long", time: 2003, cause: "ICD-10" },
            { entityName: "Short", time: 2000, cause: "ICD-9" },
            { entityName: "Short", time: 2003, cause: "ICD-10" },
            { entityName: "Bravo", time: 2000, cause: "ICD-9" },
            { entityName: "Bravo", time: 2003, cause: "ICD-9" },
            { entityName: "Alpha", time: 2000, cause: "ICD-9" },
            { entityName: "Alpha", time: 2003, cause: "ICD-9" },
        ])
        const manager: SwimlaneChartManager = {
            table,
            selection: ["Short", "Empty", "Bravo", "Long", "Alpha"],
            yColumnSlugs: ["cause"],
        }

        const descOrder = new SwimlaneChartState({
            manager: { ...manager, sortConfig: { sortOrder: SortOrder.desc } },
        }).series.map((series) => series.seriesName)
        const ascOrder = new SwimlaneChartState({
            manager: { ...manager, sortConfig: { sortOrder: SortOrder.asc } },
        }).series.map((series) => series.seriesName)

        expect(descOrder).toEqual(["Long", "Short", "Bravo", "Alpha", "Empty"])
        expect(ascOrder).toEqual(descOrder.toReversed())
    })

    it("firstCategory keys on the first category segment instead of the last", () => {
        const table = ordinalTable([
            { entityName: "A", time: 2000, cause: "ICD-7" },
            { entityName: "A", time: 2001, cause: "ICD-10" },
            { entityName: "B", time: 2000, cause: "ICD-9" },
            { entityName: "B", time: 2001, cause: "ICD-7" },
        ])
        const manager: SwimlaneChartManager = {
            table,
            selection: ["A", "B"],
            yColumnSlugs: ["cause"],
            sortConfig: { sortBy: SortBy.firstCategory },
        }
        const chartState = new SwimlaneChartState({ manager })

        expect(chartState.series.map((series) => series.seriesName)).toEqual([
            "A",
            "B",
        ])
    })

    it("ranks firstCategory from the other end, so starting low sorts above starting high", () => {
        const table = ordinalTable([
            { entityName: "StartsLow", time: 2000, cause: "ICD-7" },
            { entityName: "StartsLow", time: 2001, cause: "ICD-10" },
            { entityName: "StartsHigh", time: 2000, cause: "ICD-9" },
            { entityName: "StartsHigh", time: 2001, cause: "ICD-10" },
        ])
        const manager: SwimlaneChartManager = {
            table,
            selection: ["StartsHigh", "StartsLow"],
            yColumnSlugs: ["cause"],
            sortConfig: { sortBy: SortBy.firstCategory },
        }

        const descOrder = new SwimlaneChartState({
            manager,
        }).series.map((series) => series.seriesName)
        const ascOrder = new SwimlaneChartState({
            manager: {
                ...manager,
                sortConfig: {
                    sortBy: SortBy.firstCategory,
                    sortOrder: SortOrder.asc,
                },
            },
        }).series.map((series) => series.seriesName)

        expect(descOrder).toEqual(["StartsLow", "StartsHigh"])
        expect(ascOrder).toEqual(descOrder.toReversed())
    })

    it("entityName sorts alphabetically", () => {
        const table = ordinalTable([
            { entityName: "France", time: 2000, cause: "ICD-9" },
            { entityName: "Albania", time: 2000, cause: "ICD-7" },
            { entityName: "Zimbabwe", time: 2000, cause: "ICD-8" },
        ])
        const manager: SwimlaneChartManager = {
            table,
            selection: ["France", "Albania", "Zimbabwe"],
            yColumnSlugs: ["cause"],
            sortConfig: { sortBy: SortBy.entityName },
        }
        const chartState = new SwimlaneChartState({ manager })

        expect(chartState.series.map((series) => series.seriesName)).toEqual([
            "Zimbabwe",
            "France",
            "Albania",
        ])
    })

    it("sortOrder asc reverses the order", () => {
        const table = ordinalTable([
            { entityName: "France", time: 2000, cause: "ICD-7" },
            { entityName: "Germany", time: 2000, cause: "ICD-9" },
            { entityName: "Japan", time: 2000, cause: "ICD-10" },
        ])
        const manager: SwimlaneChartManager = {
            table,
            selection: ["France", "Germany", "Japan"],
            yColumnSlugs: ["cause"],
            sortConfig: { sortOrder: SortOrder.asc },
        }
        const chartState = new SwimlaneChartState({ manager })

        expect(chartState.series.map((series) => series.seriesName)).toEqual([
            "France",
            "Germany",
            "Japan",
        ])
    })

    it("ignores a gap at either end, keying on the first or last category", () => {
        const table = ordinalTable([
            { entityName: "France", time: 2000, cause: "ICD-9" },
            { entityName: "France", time: 2001, cause: "ICD-9" },
            { entityName: "Georgia", time: 2000, cause: "ICD-8" },
            { entityName: "Georgia", time: 2001, cause: "ICD-8" },
            { entityName: "Georgia", time: 2003, cause: "ICD-8" },
        ])
        const manager: SwimlaneChartManager = {
            table,
            selection: ["France", "Georgia"],
            yColumnSlugs: ["cause"],
        }

        const byLastCategory = new SwimlaneChartState({ manager })

        // France has no observation at 2003, so its lane ends in a hatch
        expect(byLastCategory.series[0].segments.at(-1)?.kind).toEqual(
            "missing"
        )
        expect(
            byLastCategory.series.map((series) => series.seriesName)
        ).toEqual(["France", "Georgia"])

        const byFirstCategory = new SwimlaneChartState({
            manager: {
                ...manager,
                sortConfig: { sortBy: SortBy.firstCategory },
            },
        })
        expect(
            byFirstCategory.series.map((series) => series.seriesName)
        ).toEqual(["Georgia", "France"])
    })

    it("keys firstCategory on the first category, not on a leading gap", () => {
        const table = ordinalTable([
            { entityName: "Gappy", time: 2001, cause: "ICD-10" },
            { entityName: "Gappy", time: 2002, cause: "ICD-10" },
            { entityName: "Early", time: 2000, cause: "ICD-7" },
            { entityName: "Early", time: 2001, cause: "ICD-7" },
            { entityName: "Early", time: 2002, cause: "ICD-7" },
        ])
        const chartState = new SwimlaneChartState({
            manager: {
                table,
                selection: ["Early", "Gappy"],
                yColumnSlugs: ["cause"],
                sortConfig: { sortBy: SortBy.firstCategory },
            },
        })

        const gappy = chartState.series.find(
            (series) => series.seriesName === "Gappy"
        )
        expect(gappy?.segments[0].kind).toEqual("missing")
        expect(chartState.series.map((series) => series.seriesName)).toEqual([
            "Early",
            "Gappy",
        ])
    })

    it("falls back to lastCategory when the configured sort key is another chart type's", () => {
        const table = ordinalTable([
            { entityName: "France", time: 2000, cause: "ICD-7" },
            { entityName: "Germany", time: 2000, cause: "ICD-9" },
            { entityName: "Japan", time: 2000, cause: "ICD-10" },
        ])
        const manager: SwimlaneChartManager = {
            table,
            selection: ["France", "Germany", "Japan"],
            yColumnSlugs: ["cause"],
            sortConfig: { sortBy: SortBy.change },
        }
        const chartState = new SwimlaneChartState({ manager })

        expect(chartState.sortConfig.sortBy).toEqual(SortBy.lastCategory)
        expect(chartState.series.map((series) => series.seriesName)).toEqual([
            "Japan",
            "Germany",
            "France",
        ])
    })
})
