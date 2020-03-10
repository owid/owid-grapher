import * as fs from "fs"

import { Indicator } from "charts/Indicator"
import { ChartConfigProps } from "charts/ChartConfig"
import { DataForChart } from "charts/VariableData"

export function readBuffer(fixture: string) {
    return fs.readFileSync(__dirname + `/${fixture}.json`)
}

function readObj(fixture: string) {
    return JSON.parse(readBuffer(fixture).toString())
}

export function readVariable(id: string | number): DataForChart {
    return readObj(`variable-${id}`)
}

export function readChart(id: string | number): ChartConfigProps {
    return readObj(`chart-${id}`)
}

export function readIndicators(): { indicators: Indicator[] } {
    return readObj("indicators")
}
