import { expect, it, describe } from "vitest"
import { DimensionProperty, GrapherInterface } from "@ourworldindata/types"
import {
    hasMultipleIndicators,
    planIndicatorPanes,
} from "./indicatorPanePlan.js"

const LIFE_EXPECTANCY = 1
const GDP = 2
const POPULATION = 3
const REGION = 4

const scatterPlot: GrapherInterface = {
    chartTypes: ["ScatterPlot"],
    dimensions: [
        { property: DimensionProperty.color, variableId: REGION },
        { property: DimensionProperty.y, variableId: LIFE_EXPECTANCY },
        { property: DimensionProperty.x, variableId: GDP },
        { property: DimensionProperty.size, variableId: POPULATION },
    ],
}

describe(planIndicatorPanes, () => {
    it("gives every y-indicator of a chart a pane, in the chart's order", () => {
        const panes = planIndicatorPanes({
            chartTypes: ["LineChart"],
            dimensions: [
                { property: DimensionProperty.y, variableId: GDP },
                { property: DimensionProperty.y, variableId: POPULATION },
                // The same indicator twice gets one pane
                { property: DimensionProperty.y, variableId: GDP },
            ],
        })
        expect(panes).toEqual([{ variableId: GDP }, { variableId: POPULATION }])
    })

    it("orders a scatter plot's panes y, x, size, colour", () => {
        expect(planIndicatorPanes(scatterPlot)).toEqual([
            { variableId: LIFE_EXPECTANCY },
            { variableId: GDP },
            { variableId: POPULATION, auxiliaryRole: "size" },
            { variableId: REGION, auxiliaryRole: "color" },
        ])
    })

    it("documents a size indicator that is also on an axis by its axis pane", () => {
        const panes = planIndicatorPanes({
            chartTypes: ["ScatterPlot"],
            dimensions: [
                { property: DimensionProperty.y, variableId: LIFE_EXPECTANCY },
                { property: DimensionProperty.x, variableId: GDP },
                { property: DimensionProperty.size, variableId: GDP },
            ],
        })
        expect(panes).toEqual([
            { variableId: LIFE_EXPECTANCY },
            { variableId: GDP },
        ])
    })

    it("gives the x-indicator of a chart that isn't a scatter plot no pane", () => {
        const panes = planIndicatorPanes({
            chartTypes: ["Marimekko"],
            dimensions: [
                { property: DimensionProperty.y, variableId: LIFE_EXPECTANCY },
                { property: DimensionProperty.x, variableId: POPULATION },
            ],
        })
        expect(panes).toEqual([{ variableId: LIFE_EXPECTANCY }])
    })

    it("takes the chart's name for an indicator, unless it is blank", () => {
        const panes = planIndicatorPanes({
            chartTypes: ["LineChart"],
            dimensions: [
                {
                    property: DimensionProperty.y,
                    variableId: LIFE_EXPECTANCY,
                    display: { name: "  " },
                },
                {
                    property: DimensionProperty.y,
                    variableId: GDP,
                    display: { name: "GDP per capita" },
                },
            ],
        })
        expect(panes).toEqual([
            { variableId: LIFE_EXPECTANCY },
            { variableId: GDP, chartDimensionName: "GDP per capita" },
        ])
    })
})

describe(hasMultipleIndicators, () => {
    it("is true of a scatter plot with an x-indicator", () => {
        expect(hasMultipleIndicators(scatterPlot)).toBe(true)
    })

    it("is false of a chart whose only other indicator has no pane", () => {
        expect(
            hasMultipleIndicators({
                chartTypes: ["Marimekko"],
                dimensions: [
                    {
                        property: DimensionProperty.y,
                        variableId: LIFE_EXPECTANCY,
                    },
                    { property: DimensionProperty.x, variableId: POPULATION },
                ],
            })
        ).toBe(false)
    })
})
