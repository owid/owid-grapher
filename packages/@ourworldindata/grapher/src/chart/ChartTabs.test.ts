import { expect, it, describe } from "vitest"
import { findValidChartTypeCombination } from "./ChartTabs"
import { GRAPHER_CHART_TYPES } from "@ourworldindata/types"

const {
    LineChart,
    SlopeChart,
    DiscreteBar,
    StackedArea,
    StackedBar,
    StackedDiscreteBar,
} = GRAPHER_CHART_TYPES

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
        const chartTypes = [LineChart, StackedArea, SlopeChart]
        expect(findValidChartTypeCombination(chartTypes)).toEqual([
            LineChart,
            SlopeChart,
        ])
    })

    it("allows subsets of valid combinations", () => {
        const chartTypes = [SlopeChart]
        expect(findValidChartTypeCombination(chartTypes)).toEqual([SlopeChart])
    })

    it("works for stacked chart type combinations", () => {
        const chartTypes = [StackedArea, StackedDiscreteBar]
        expect(findValidChartTypeCombination(chartTypes)).toEqual([
            StackedArea,
            StackedDiscreteBar,
        ])
    })

    it("falls back to any valid chart type if the combination is invalid", () => {
        const chartTypes = [StackedArea, DiscreteBar, StackedBar]
        expect(findValidChartTypeCombination(chartTypes)).toEqual([DiscreteBar])
    })
})
