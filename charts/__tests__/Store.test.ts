#! /usr/bin/env jest

import { observe } from "mobx"

import { RootStore, IndicatorStore } from "charts/Store"
import * as fixtures from "test/fixtures"
import * as apiMock from "test/apiMock"

const indicatorsBuffer = fixtures.readBuffer("indicators")
const indicator = fixtures.readIndicators().indicators[0]

function createIndicatorStore() {
    return new IndicatorStore()
}

function createRootStore() {
    return new RootStore()
}

describe(IndicatorStore, () => {
    let store: IndicatorStore

    apiMock.init()

    describe("get()", () => {
        beforeEach(() => apiMock.mockIndicators())
        beforeEach(() => (store = createIndicatorStore()))

        it("returns a placeholder value", () => {
            expect(store.get(indicator.id))
        })

        it("updates placeholder value with indicator", done => {
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
        beforeEach(() => apiMock.mockIndicators())
        beforeEach(() => (store = createIndicatorStore()))

        it("returns all indicators for no query", async () => {
            const results = await store.search({ query: "" })
            expect(results).toHaveLength(1)
        })

        it("returns found indicators for matching query", async () => {
            const results = await store.search({ query: "child" })
            expect(results).toHaveLength(1)
            expect(results).toContain(store.get(indicator.id))
        })

        it("returns no indicators for non-matching query", async () => {
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
