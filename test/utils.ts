import { ChartConfig, ChartConfigProps } from "charts/ChartConfig"

import * as fixtures from "./fixtures"

export function createConfig(props?: Partial<ChartConfigProps>) {
    const config = new ChartConfig(new ChartConfigProps(props))
    // ensureValidConfig() is only run on non-node environments, so we have
    // to manually trigger it.
    config.ensureValidConfig()
    return config
}

export function setupChart(
    id: 677 | 792,
    varId: 3512 | 104402,
    configOverrides?: Partial<ChartConfigProps>
) {
    const props = new ChartConfigProps({
        ...fixtures.readChart(id),
        ...configOverrides
    })
    const chart = new ChartConfig(props)
    chart.receiveData(fixtures.readVariable(varId))
    return chart
}
