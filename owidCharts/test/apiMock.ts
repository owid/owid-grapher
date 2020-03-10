import xhrMock from "xhr-mock"

import * as fixtures from "./fixtures"

export function mockIndicators() {
    const pattern = /\/explore\/indicators\.json/
    xhrMock.get(pattern, { body: fixtures.readBuffer("indicators") })
}

export function mockVariable(id: number | string) {
    const pattern = new RegExp(`\/grapher\/data\/variables\/${id}\.json`)
    xhrMock.get(pattern, { body: fixtures.readBuffer(`variable-${id}`) })
}

export function init() {
    beforeAll(() => xhrMock.setup())
    afterAll(() => xhrMock.teardown())
}
