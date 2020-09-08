// Todo: remove file.

import * as fs from "fs"

import { GrapherConfigInterface } from "grapher/core/GrapherConfig"
import { OwidVariablesAndEntityKey } from "owidTable/OwidVariable"

const readObj = (fixture: string) =>
    JSON.parse(fs.readFileSync(__dirname + `/${fixture}.mock.json`, "utf8"))

export function readVariable(id: string | number): OwidVariablesAndEntityKey {
    return readObj(`variable-${id}`)
}

export function readVariableSet(
    ids: string[] | number[]
): OwidVariablesAndEntityKey {
    return readObj(`variableset-${ids.join("-")}`)
}

export function readGrapher(id: string | number): GrapherConfigInterface {
    return readObj(`chart-${id}`)
}
