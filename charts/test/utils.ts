// Todo: remove file.

import { GrapherInterface } from "charts/core/GrapherInterface"
import { Grapher } from "charts/core/Grapher"

import { readVariableSet, readVariable, readChart } from "./fixtures"
import { first } from "lodash"

export function createGrapher(props?: Partial<GrapherInterface>) {
    const grapher = new Grapher(props)
    // ensureValidConfig() is only run on non-node environments, so we have
    // to manually trigger it.
    grapher.ensureValidConfig()
    return grapher
}

export function setupChart(
    id: number,
    varIds: number[],
    configOverrides?: Partial<GrapherInterface>
) {
    const variableSet =
        varIds.length > 1
            ? readVariableSet(varIds)
            : readVariable(first(varIds) as number)

    const chart = new Grapher({
        ...readChart(id),
        ...configOverrides,
        owidDataset: variableSet
    })
    return chart
}
