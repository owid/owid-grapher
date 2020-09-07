#! /usr/bin/env yarn jest

import { createGrapher } from "grapher/test/utils"

describe("ChartConfig", () => {
    it("allows single-dimensional explorer charts", () => {
        const grapher = createGrapher({
            type: "LineChart",
            hasChartTab: false,
            hasMapTab: false,
            isExplorable: true,
            dimensions: [{ property: "y", variableId: 1, display: {} }],
        })
        expect(grapher.isExplorable).toBe(true)
    })

    it("does not allow explorable scatter plots", () => {
        const grapher = createGrapher({
            type: "ScatterPlot",
            hasChartTab: true,
            isExplorable: true,
            dimensions: [{ property: "y", variableId: 1, display: {} }],
        })
        expect(grapher.isExplorable).toBe(false)
    })

    it("does not allow multi-dimensional charts", () => {
        const grapher = createGrapher({
            type: "LineChart",
            hasChartTab: true,
            isExplorable: true,
            dimensions: [
                { property: "y", variableId: 1, display: {} },
                { property: "y", variableId: 2, display: {} },
            ],
        })
        expect(grapher.isExplorable).toBe(false)
    })
})
