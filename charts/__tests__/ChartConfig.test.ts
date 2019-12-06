import { ChartConfig, ChartConfigProps } from "charts/ChartConfig"

function createConfig(props: Partial<ChartConfigProps>) {
    const config = new ChartConfig(new ChartConfigProps(props))
    // ensureValidConfig() is only run on non-node environments, so we have
    // to manually trigger it.
    config.ensureValidConfig()
    return config
}

describe("ChartConfig", () => {
    it("map & chart tabs are force enabled when an explorer", () => {
        const config = createConfig({
            type: "LineChart",
            hasChartTab: false,
            hasMapTab: false,
            isExplorable: true
        })
        expect(config.hasMapTab).toBe(true)
        expect(config.hasChartTab).toBe(true)
    })

    it("explorer not available for scatter plots", () => {
        const config = createConfig({
            type: "ScatterPlot",
            hasChartTab: true,
            isExplorable: true
        })
        expect(config.isExplorable).toBe(false)
    })
})
