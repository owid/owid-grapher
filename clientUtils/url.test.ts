#! /usr/bin/env jest

import { queryParamsToStr, strToQueryParams } from "./url"

const testCases = [
    {
        queryStr: "?foo=bar",
        params: { _original: { foo: "bar" }, decoded: { foo: "bar" } },
    },
    {
        queryStr: "?foo=bar&baz=false&bar=0",
        params: {
            _original: { foo: "bar", baz: "false", bar: "0" },
            decoded: { foo: "bar", baz: "false", bar: "0" },
        },
    },
    {
        queryStr: "?country=East+Asia+%26+Pacific",
        params: {
            _original: { country: "East+Asia+%26+Pacific" },
            decoded: { country: "East Asia & Pacific" },
        },
    },
    {
        queryStr: "?country=East%20Asia%20%26%20Pacific",
        params: {
            _original: { country: "East%20Asia%20%26%20Pacific" },
            decoded: { country: "East Asia & Pacific" },
        },
        ignoreInToQueryStrTest: true,
    },
    {
        queryStr: "?foo=%2526",
        params: { _original: { foo: "%2526" }, decoded: { foo: "%26" } },
    },
    {
        queryStr: "?foo=",
        params: { _original: { foo: "" }, decoded: { foo: "" } },
    },
    {
        queryStr: "?foo",
        params: { _original: { foo: undefined }, decoded: { foo: undefined } },
        ignoreInToQueryStrTest: true,
    },
]

describe(queryParamsToStr, () => {
    for (const testCase of testCases) {
        if (testCase.ignoreInToQueryStrTest) continue

        it(`can convert query params to a query string: '${testCase.queryStr}'`, () => {
            expect(queryParamsToStr(testCase.params.decoded)).toEqual(
                testCase.queryStr
            )
        })
    }
})

describe(strToQueryParams, () => {
    for (const testCase of testCases) {
        it(`can convert query string to a query params object: '${testCase.queryStr}'`, () => {
            expect(strToQueryParams(testCase.queryStr)).toEqual(testCase.params)
        })
    }
})
