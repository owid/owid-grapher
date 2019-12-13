import * as fs from "fs"
import xhrMock from "xhr-mock"

import { RootStore, IndicatorStore } from "charts/Store"
import { Indicator } from "charts/Indicator"
import { observe } from "mobx"

const indicatorsJson = fs.readFileSync("test/fixtures/indicators.json")
const indicatorsUrl = /\/explore\/indicators\.json/
const indicator: Indicator = JSON.parse(indicatorsJson.toString()).indicators[0]

function createIndicatorStore() {
    return new IndicatorStore()
}

function createRootStore() {
    return new RootStore()
}

function mockDataResponse() {
    xhrMock.get(indicatorsUrl, { body: indicatorsJson })
}

describe(IndicatorStore, () => {
    beforeAll(() => xhrMock.setup())
    afterAll(() => xhrMock.teardown())

    describe("get()", () => {
        it("returns a placeholder value", () => {
            mockDataResponse()
            const store = createIndicatorStore()
            expect(store.get(indicator.id))
        })

        it("updates placeholder value with indicator", done => {
            mockDataResponse()
            const store = createIndicatorStore()
            const entry = store.get(indicator.id)
            const dispose = observe(entry, "entity", () => {
                expect(entry.isLoading).toBe(false)
                expect(entry.lastRetrieved).toBeDefined()
                expect(entry.error).toBeUndefined()
                expect(entry.entity).toEqual(indicator)
                dispose()
                done()
            })
        })

        it("updates placeholder with error", done => {
            mockDataResponse()
            const store = createIndicatorStore()
            const entry = store.get(123123123)
            const dispose = observe(entry, "error", () => {
                expect(entry.isLoading).toBe(false)
                expect(entry.lastRetrieved).toBeUndefined()
                expect(entry.error).toBeDefined()
                expect(entry.entity).toBeUndefined()
                dispose()
                done()
            })
        })
    })

    describe("search()", () => {
        beforeAll(() => xhrMock.setup())
        afterAll(() => xhrMock.teardown())

        it("returns all indicators for no query", async () => {
            mockDataResponse()
            const store = createIndicatorStore()
            const results = await store.search({ query: "" })
            expect(results).toHaveLength(1)
        })

        it("returns found indicators for matching query", async () => {
            mockDataResponse()
            const store = createIndicatorStore()
            const results = await store.search({ query: "child" })
            expect(results).toHaveLength(1)
            expect(results).toContain(store.get(indicator.id))
        })

        it("returns no indicators for non-matching query", async () => {
            mockDataResponse()
            const store = createIndicatorStore()
            const results = await store.search({
                query: "a thing that probably shouldn't exist"
            })
            expect(results).toHaveLength(0)
        })
    })
})

describe(RootStore, () => {
    it("mounts IndicatorStore", () => {
        const rootStore = createRootStore()
        expect(rootStore.indicators).toBeInstanceOf(IndicatorStore)
    })
})
