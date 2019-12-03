import { ChartConfig, ChartConfigProps } from "charts/ChartConfig"

function createConfig(props: ChartConfigProps) {
    const config = new ChartConfig(props)
    // ensureValidConfig() is only run on non-node environments, so we have
    // to manually trigger it.
    config.ensureValidConfig()
    return config
}

describe("ChartConfig", () => {
    it("map & chart tabs are force enabled when an explorer", () => {
        const props = new ChartConfigProps()
        props.type = "LineChart"
        props.hasChartTab = false
        props.hasMapTab = false
        props.isExplorable = true
        const config = createConfig(props)
        expect(config.hasMapTab).toBe(true)
        expect(config.hasChartTab).toBe(true)
    })

    it("explorer not available for scatter plots", () => {
        const props = new ChartConfigProps()
        props.type = "ScatterPlot"
        props.hasChartTab = true
        props.isExplorable = true
        const config = createConfig(props)
        expect(config.isExplorable).toBe(false)
    })
})
