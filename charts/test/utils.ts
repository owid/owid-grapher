// Todo: remove file.

import { ChartScript } from "charts/core/ChartScript"
import { ChartConfig } from "charts/core/ChartConfig"

import * as fixtures from "./fixtures"
import { first } from "lodash"

export function createConfig(props?: Partial<ChartScript>) {
    const config = new ChartConfig(new ChartScript(props))
    // ensureValidConfig() is only run on non-node environments, so we have
    // to manually trigger it.
    config.ensureValidConfig()
    return config
}

export function setupChart(
    id: number,
    varIds: number[],
    configOverrides?: Partial<ChartScript>
) {
    const variableSet =
        varIds.length > 1
            ? fixtures.readVariableSet(varIds)
            : fixtures.readVariable(first(varIds) as number)

    const props = new ChartScript({
        ...fixtures.readChart(id),
        ...configOverrides,
        owidDataset: variableSet
    })

    const chart = new ChartConfig(props)
    return chart
}
