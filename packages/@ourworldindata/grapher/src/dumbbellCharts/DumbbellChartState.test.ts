import { expect, it, describe } from "vitest"
import { DumbbellChartState } from "./DumbbellChartState"
import { DumbbellChartManager } from "./DumbbellChartConstants"
import {
    OwidTable,
    SampleColumnSlugs,
    SynthesizeFruitTableWithNonPositives,
    SynthesizeFruitTableWithStringValues,
    SynthesizeGDPTable,
} from "@ourworldindata/core-table"
import { ScaleType, SortBy, SortOrder } from "@ourworldindata/types"

describe("time-range mode", () => {
    const table = SynthesizeGDPTable({ timeRange: [2000, 2010] })
    const manager: DumbbellChartManager = {
        table,
        yColumnSlug: SampleColumnSlugs.Population,
        selection: table.availableEntityNames,
    }

    it("constructs series with start and end values", () => {
        const state = new DumbbellChartState({ manager })
        expect(state.mode).toEqual("time-range")
        expect(state.series.length).toEqual(2)
        for (const series of state.series) {
            expect(series.start.value).toBeTypeOf("number")
            expect(series.end.value).toBeTypeOf("number")
            expect(series.start.time).toBeLessThan(series.end.time)
        }
    })
})

describe("two-column mode", () => {
    const table = new OwidTable({
        entityName: ["france", "germany", "france", "germany"],
        year: [2020, 2020, 2021, 2021],
        gdp: [100, 200, 110, 210],
        pop: [50, 80, 55, 85],
    })

    it("pairs columns as start and end", () => {
        const manager: DumbbellChartManager = {
            table,
            yColumnSlugs: ["gdp", "pop"],
            selection: ["france", "germany"],
        }
        const state = new DumbbellChartState({ manager })
        expect(state.mode).toEqual("two-column")
        expect(state.series.length).toEqual(2)
        for (const series of state.series) {
            expect(series.start.columnSlug).toEqual("gdp")
            expect(series.end.columnSlug).toEqual("pop")
        }
    })
})

it("filters non-numeric values", () => {
    const table = SynthesizeFruitTableWithStringValues(
        { entityCount: 2, timeRange: [2000, 2002] },
        1,
        1
    )
    const manager: DumbbellChartManager = {
        table,
        yColumnSlugs: [SampleColumnSlugs.Fruit],
        selection: table.availableEntityNames,
    }
    const state = new DumbbellChartState({ manager })
    for (const series of state.series) {
        expect(series.start.value).toBeTypeOf("number")
        expect(series.end.value).toBeTypeOf("number")
    }
})

it("filters non-positive values when using log scale", () => {
    const table = SynthesizeFruitTableWithNonPositives(
        { entityCount: 2, timeRange: [2000, 2002] },
        1,
        1
    )
    const manager: DumbbellChartManager = {
        table,
        yColumnSlugs: [SampleColumnSlugs.Fruit],
        selection: table.availableEntityNames,
    }

    const normalState = new DumbbellChartState({ manager })
    const normalValueCount = normalState.allYValues.length

    const logState = new DumbbellChartState({
        manager: {
            ...manager,
            yAxisConfig: { scaleType: ScaleType.log },
        },
    })
    expect(logState.allYValues.length).toBeLessThan(normalValueCount)
    for (const val of logState.allYValues) {
        expect(val).toBeGreaterThan(0)
    }
})

describe("sorting", () => {
    const table = new OwidTable({
        entityName: ["a", "b", "c", "a", "b", "c"],
        year: [2000, 2000, 2000, 2010, 2010, 2010],
        val: [10, 30, 20, 15, 35, 25],
    })
    const baseManager: DumbbellChartManager = {
        table,
        yColumnSlugs: ["val"],
        selection: ["a", "b", "c"],
    }

    it("sorts by end value descending by default", () => {
        const state = new DumbbellChartState({ manager: baseManager })
        const endValues = state.series.map((s) => s.end.value)
        expect(endValues).toEqual([35, 25, 15])
    })

    it("respects sort order ascending", () => {
        const state = new DumbbellChartState({
            manager: {
                ...baseManager,
                sortConfig: {
                    sortBy: SortBy.total,
                    sortOrder: SortOrder.asc,
                },
            },
        })
        const endValues = state.series.map((s) => s.end.value)
        expect(endValues).toEqual([15, 25, 35])
    })
})

it("excludes entities with missing data at one endpoint", () => {
    const table = new OwidTable({
        entityName: ["complete", "complete", "partial"],
        year: [2000, 2010, 2010],
        val: [100, 200, 300],
    })
    const manager: DumbbellChartManager = {
        table,
        yColumnSlugs: ["val"],
        selection: ["complete", "partial"],
    }
    const state = new DumbbellChartState({ manager })
    expect(state.series.length).toEqual(1)
    expect(state.series[0].entityName).toEqual("complete")
})
