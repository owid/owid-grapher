// Todo: remove file.

import { GrapherInterface } from "grapher/core/GrapherInterface"
import { Grapher } from "grapher/core/Grapher"

import { readVariableSet, readVariable, readGrapher } from "./fixtures"
import { first } from "lodash"

export function createGrapher(props?: Partial<GrapherInterface>) {
    const grapher = new Grapher(props)
    // ensureValidConfig() is only run on non-node environments, so we have
    // to manually trigger it.
    grapher.ensureValidConfig()
    return grapher
}

export function setupGrapher(
    id: number,
    varIds: number[],
    configOverrides?: Partial<GrapherInterface>
) {
    const variableSet =
        varIds.length > 1
            ? readVariableSet(varIds)
            : readVariable(first(varIds) as number)

    return new Grapher({
        ...readGrapher(id),
        ...configOverrides,
        owidDataset: variableSet
    })
}
