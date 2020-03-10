#! /usr/bin/env jest

import { ChartConfig, ChartConfigProps } from "charts/ChartConfig"

function createConfig(props: Partial<ChartConfigProps>) {
    const config = new ChartConfig(new ChartConfigProps(props))
    // ensureValidConfig() is only run on non-node environments, so we have
    // to manually trigger it.
    config.ensureValidConfig()
    return config
}

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
