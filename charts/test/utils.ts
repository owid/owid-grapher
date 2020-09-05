// Todo: remove file.

import { GrapherScript } from "charts/core/GrapherScript"
import { Grapher } from "charts/core/Grapher"

import { readVariableSet, readVariable, readChart } from "./fixtures"
import { first } from "lodash"

export function createConfig(props?: Partial<GrapherScript>) {
    const config = new Grapher(new GrapherScript(props))
    // ensureValidConfig() is only run on non-node environments, so we have
    // to manually trigger it.
    config.ensureValidConfig()
    return config
}

export function setupChart(
    id: number,
    varIds: number[],
    configOverrides?: Partial<GrapherScript>
) {
    const variableSet =
        varIds.length > 1
            ? readVariableSet(varIds)
            : readVariable(first(varIds) as number)

    const props = new GrapherScript({
        ...readChart(id),
        ...configOverrides,
        owidDataset: variableSet
    })

    const chart = new Grapher(props)
    return chart
}
