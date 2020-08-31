import * as fs from "fs"

import { ChartScript } from "charts/core/ChartScript"
import { OwidVariablesAndEntityKey } from "owidTable/OwidVariable"
import { Post } from "db/model/Post"
import { RelatedChart } from "site/client/blocks/RelatedCharts/RelatedCharts"

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

export function readChart(id: string | number): ChartScript {
    return readObj(`chart-${id}`)
}

export function readPost(id: number): Post.Row {
    return readObj(`post-row-${id}`)
}

export function readChartsPost(id: number): RelatedChart[] {
    return readObj(`charts-post-${id}`)
}
