import { describe, it, expect } from "vitest"
import {
    GRAPHER_CHART_TYPES,
    GrapherValuesJson,
    GrapherValuesJsonDataPoint,
} from "@ourworldindata/types"
import { buildChartHitDataDisplayProps } from "./SearchHelpers.js"

function makePoint(
    columnSlug: string,
    time: number,
    value: number
): GrapherValuesJsonDataPoint {
    return {
        columnSlug,
        value,
        formattedValueShort: String(value),
        time,
        formattedTime: String(time),
    }
}

describe(buildChartHitDataDisplayProps, () => {
    it("shows a single end value for charts that don't compare two time points", () => {
        const chartInfo: GrapherValuesJson = {
            source: "Source",
            columns: { pop: { name: "Population" } },
            startValues: { y: [makePoint("pop", 2000, 100)] },
            endValues: { y: [makePoint("pop", 2020, 200)] },
        }

        const result = buildChartHitDataDisplayProps({
            chartInfo,
            chartType: GRAPHER_CHART_TYPES.LineChart,
            entity: "France",
        })

        // Even though start values exist, a line chart only shows the end value
        expect(result).toMatchObject({ endValue: "200", time: "2020" })
        expect(result?.startValue).toBeUndefined()
    })

    it("shows a start–end range with trend for a time-range dumbbell", () => {
        const chartInfo: GrapherValuesJson = {
            source: "Source",
            columns: { gdp: { name: "GDP", unit: "international-$" } },
            startValues: { y: [makePoint("gdp", 2000, 100)] },
            endValues: { y: [makePoint("gdp", 2020, 200)] },
        }

        const result = buildChartHitDataDisplayProps({
            chartInfo,
            chartType: GRAPHER_CHART_TYPES.Dumbbell,
            entity: "France",
        })

        expect(result).toMatchObject({
            entityName: "France",
            startValue: "100",
            endValue: "200",
            time: "2000–2020",
            trend: "up",
            unit: "international-$",
        })
    })

    it("returns undefined for a two-column dumbbell (more than one y-indicator)", () => {
        const chartInfo: GrapherValuesJson = {
            source: "Source",
            columns: { fruit: { name: "Fruit" }, veg: { name: "Vegetables" } },
            endValues: {
                y: [makePoint("fruit", 2020, 10), makePoint("veg", 2020, 20)],
            },
        }

        expect(
            buildChartHitDataDisplayProps({
                chartInfo,
                chartType: GRAPHER_CHART_TYPES.Dumbbell,
                entity: "France",
            })
        ).toBeUndefined()
    })

    it("shows a single value for scatter plots when the x-axis is GDP", () => {
        const makeScatterInfo = (xColumn: {
            slug: string
            name: string
        }): GrapherValuesJson => ({
            source: "",
            columns: {
                life: { name: "Life expectancy" },
                [xColumn.slug]: { name: xColumn.name },
            },
            endValues: {
                y: [makePoint("life", 2020, 80)],
                x: makePoint(xColumn.slug, 2020, 1000),
            },
        })

        // Arbitrary x-axis -> no value display
        expect(
            buildChartHitDataDisplayProps({
                chartInfo: makeScatterInfo({ slug: "pop", name: "Population" }),
                chartType: GRAPHER_CHART_TYPES.ScatterPlot,
                entity: "France",
            })
        ).toBeUndefined()

        // GDP x-axis -> value display is shown
        expect(
            buildChartHitDataDisplayProps({
                chartInfo: makeScatterInfo({
                    slug: "gdp",
                    name: "GDP per capita",
                }),
                chartType: GRAPHER_CHART_TYPES.ScatterPlot,
                entity: "France",
            })
        ).toMatchObject({ endValue: "80" })
    })
})
