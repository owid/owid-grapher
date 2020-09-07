import xhrMock from "xhr-mock"

import * as fs from "fs-extra"

import { Indicator } from "explorer/indicatorExplorer/Indicator"

export function mockIndicators() {
    const pattern = /\/explore\/indicators\.json/
    xhrMock.get(pattern, {
        body: fs.readFileSync(__dirname + `/indicators.mock.json`),
    })
}

export function mockVariable(id: number | string) {
    const pattern = new RegExp(`\/grapher\/data\/variables\/${id}\.json`)
    xhrMock.get(pattern, {
        body: fs.readFileSync(
            __dirname + "/../../grapher/test/" + `variable-${id}.mock.json`
        ),
    })
}

export function init() {
    beforeAll(() => xhrMock.setup())
    afterAll(() => xhrMock.teardown())
}

export function readIndicators(): { indicators: Indicator[] } {
    return JSON.parse(
        fs.readFileSync(__dirname + "/indicators.mock.json", "utf8")
    )
}
