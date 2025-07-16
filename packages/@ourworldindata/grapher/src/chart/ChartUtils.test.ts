import { expect, it, describe } from "vitest"
import { findValidChartTypeCombination } from "./ChartUtils"
import { GRAPHER_CHART_TYPES } from "@ourworldindata/types"

const { LineChart, SlopeChart, ScatterPlot, StackedArea } = GRAPHER_CHART_TYPES

describe(findValidChartTypeCombination, () => {
    it("works for valid chart type combinations", () => {
        const chartTypes = [LineChart, SlopeChart]
        expect(findValidChartTypeCombination(chartTypes)).toEqual([
            LineChart,
            SlopeChart,
        ])
    })

    it("orders chart types correctly", () => {
        const chartTypes = [SlopeChart, LineChart]
        expect(findValidChartTypeCombination(chartTypes)).toEqual([
            LineChart,
            SlopeChart,
        ])
    })

    it("ignores invalid chart types in a combination", () => {
        const chartTypes = [LineChart, ScatterPlot, SlopeChart]
        expect(findValidChartTypeCombination(chartTypes)).toEqual([
            LineChart,
            SlopeChart,
        ])
    })

    it("allows subsets of valid combinations", () => {
        const chartTypes = [SlopeChart]
        expect(findValidChartTypeCombination(chartTypes)).toEqual([SlopeChart])
    })

    it("returns undefined if no valid chart type combination is found", () => {
        const chartTypes = [StackedArea, ScatterPlot]
        expect(findValidChartTypeCombination(chartTypes)).toBeUndefined()
    })
})
