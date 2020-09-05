// Todo: remove file.

import * as fs from "fs"

import { GrapherScript } from "charts/core/GrapherScript"
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

export function readChart(id: string | number): GrapherScript {
    return readObj(`chart-${id}`)
}
