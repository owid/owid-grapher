import { expect, it, describe } from "vitest"

import { OwidTable } from "@ourworldindata/core-table"
import { ColumnSlug, CoreMatrix } from "@ourworldindata/types"
import { DumbbellChartState } from "./DumbbellChartState"
import { DumbbellChartManager, DumbbellMode } from "./DumbbellChartConstants"

const makeChartState = (
    rows: CoreMatrix,
    yColumnSlugs: ColumnSlug[] = ["gdp"]
): DumbbellChartState => {
    const table = new OwidTable(rows)
    const manager: DumbbellChartManager = {
        table,
        selection: table.availableEntityNames,
        yColumnSlugs,
    }
    return new DumbbellChartState({ manager })
}

describe("entity strategy", () => {
    it("constructs dumbbell series across two time points", () => {
        const chartState = makeChartState([
            ["gdp", "year", "entityName"],
            [100, 2000, "USA"],
            [150, 2010, "USA"],
            [80, 2000, "UK"],
            [60, 2010, "UK"],
        ])

        expect(chartState.errorInfo.reason).toEqual("")
        expect(chartState.series.length).toEqual(2)

        const usa = chartState.series.find((s) => s.entityName === "USA")!
        expect(usa.start.value).toEqual(100)
        expect(usa.end.value).toEqual(150)
        expect(usa.start.time).toEqual(2000)
        expect(usa.end.time).toEqual(2010)
    })

    it("colors series by direction of change", () => {
        const chartState = makeChartState([
            ["gdp", "year", "entityName"],
            [100, 2000, "Riser"],
            [150, 2010, "Riser"],
            [100, 2000, "Faller"],
            [50, 2010, "Faller"],
        ])

        const riser = chartState.series.find((s) => s.entityName === "Riser")!
        const faller = chartState.series.find((s) => s.entityName === "Faller")!

        expect(riser.color).not.toEqual(faller.color)
    })

    it("filters out series with missing start or end value", () => {
        const chartState = makeChartState([
            ["gdp", "year", "entityName"],
            [100, 2000, "Complete"],
            [150, 2010, "Complete"],
            [80, 2000, "MissingEnd"],
        ])

        expect(chartState.series.length).toEqual(1)
        expect(chartState.series[0].entityName).toEqual("Complete")
    })
})

describe("column strategy", () => {
    it("constructs series comparing two columns at one time", () => {
        const chartState = makeChartState(
            [
                ["population", "gdp", "year", "entityName"],
                [100, 500, 2010, "USA"],
            ],
            ["population", "gdp"]
        )

        expect(chartState.mode).toEqual(DumbbellMode.TwoColumn)
        expect(chartState.series.length).toEqual(1)

        const series = chartState.series[0]
        expect(series.start.value).toEqual(100)
        expect(series.end.value).toEqual(500)
    })
})
