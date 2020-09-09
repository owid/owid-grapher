// Todo: remove file.

import { GrapherConfigInterface } from "grapher/core/GrapherConfig"
import { Grapher } from "grapher/core/Grapher"

import { first } from "lodash"
import { OwidVariablesAndEntityKey } from "owidTable/OwidVariable"
import { readFileSync } from "fs-extra"

const readObj = (fixture: string) =>
    JSON.parse(readFileSync(__dirname + `/${fixture}.mock.json`, "utf8"))

const readVariable = (id: string | number): OwidVariablesAndEntityKey =>
    readObj(`variable-${id}`)

const readVariableSet = (ids: string[] | number[]): OwidVariablesAndEntityKey =>
    readObj(`variableset-${ids.join("-")}`)

export function setupGrapher(
    id: number,
    varIds: number[],
    configOverrides?: Partial<GrapherConfigInterface>
) {
    const variableSet =
        varIds.length > 1
            ? readVariableSet(varIds)
            : readVariable(first(varIds) as number)

    return new Grapher({
        ...readGrapherConfig(id),
        ...configOverrides,
        owidDataset: variableSet,
    })
}

export const readGrapherConfig = (
    id: string | number
): GrapherConfigInterface => readObj(`chart-${id}`)
