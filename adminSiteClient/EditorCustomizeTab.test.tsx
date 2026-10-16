import { describe, expect, it } from "vitest"
import {
    ColumnTypeNames,
    GRAPHER_CHART_TYPES,
    SortOrder,
} from "@ourworldindata/types"
import { OwidTable } from "@ourworldindata/core-table"
import { GrapherState } from "@ourworldindata/grapher"
import { ConfigEditor } from "./ConfigEditor.js"
import { SortOrderSection } from "./EditorCustomizeTab.js"

describe(SortOrderSection, () => {
    it("reverses an unconfigured swimlane's lanes when the sort order changes", () => {
        const table = new OwidTable(
            [
                { entityName: "France", year: 2000, regime: "Monarchy" },
                { entityName: "Germany", year: 2000, regime: "Republic" },
            ],
            [
                { slug: "year", type: ColumnTypeNames.Year },
                { slug: "regime", type: ColumnTypeNames.String },
            ]
        )
        const grapherState = new GrapherState({
            table,
            ySlugs: "regime",
            chartTypes: [GRAPHER_CHART_TYPES.Swimlane],
            selectedEntityNames: ["France", "Germany"],
        })
        const section = new SortOrderSection({
            editor: { grapherState } as unknown as ConfigEditor,
        })
        const findLaneNames = (): string[] =>
            grapherState.chartStateExceptMap.series.map(
                (series) => series.seriesName
            )

        expect(section.sortConfig.sortOrder).toBe(SortOrder.asc)
        expect(findLaneNames()).toEqual(["France", "Germany"])

        section.onSortOrderChange(SortOrder.desc)
        expect(findLaneNames()).toEqual(["Germany", "France"])

        section.onSortOrderChange(SortOrder.asc)
        expect(findLaneNames()).toEqual(["France", "Germany"])
    })
})
