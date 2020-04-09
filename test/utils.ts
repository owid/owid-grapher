import { ChartConfig, ChartConfigProps } from "charts/ChartConfig"

export function createConfig(props: Partial<ChartConfigProps>) {
    const config = new ChartConfig(new ChartConfigProps(props))
    // ensureValidConfig() is only run on non-node environments, so we have
    // to manually trigger it.
    config.ensureValidConfig()
    return config
}
