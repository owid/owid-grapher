import * as fs from "fs"

import { Indicator } from "charts/Indicator"
import { ChartConfigProps } from "charts/ChartConfig"
import { DataForChart } from "charts/VariableData"

export function readBuffer(fixture: string) {
    return fs.readFileSync(`test/fixtures/${fixture}.json`)
}

export function readData(fixture: string) {
    return readBuffer(fixture).toString()
}

export function readObj(fixture: string) {
    return JSON.parse(readData(fixture))
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
