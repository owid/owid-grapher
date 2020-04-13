#! /usr/bin/env yarn jest

import { createConfig } from "test/utils"

describe("ChartConfig", () => {
    it("allows single-dimensional explorer charts", () => {
        const config = createConfig({
            type: "LineChart",
            hasChartTab: false,
            hasMapTab: false,
            isExplorable: true,
            dimensions: [{ property: "y", variableId: 1, display: {} }]
        })
        expect(config.isExplorable).toBe(true)
    })

    it("does not allow explorable scatter plots", () => {
        const config = createConfig({
            type: "ScatterPlot",
            hasChartTab: true,
            isExplorable: true,
            dimensions: [{ property: "y", variableId: 1, display: {} }]
        })
        expect(config.isExplorable).toBe(false)
    })

    it("does not allow multi-dimensional charts", () => {
        const config = createConfig({
            type: "LineChart",
            hasChartTab: true,
            isExplorable: true,
            dimensions: [
                { property: "y", variableId: 1, display: {} },
                { property: "y", variableId: 2, display: {} }
            ]
        })
        expect(config.isExplorable).toBe(false)
    })
})
