#! /usr/bin/env jest

import { queryParamsToStr, strToQueryParams } from "./url"

const testCases = [
    { queryStr: "?foo=bar", params: { foo: "bar" } },
    {
        queryStr: "?foo=bar&baz=false&bar=0",
        params: { foo: "bar", baz: "false", bar: "0" },
    },
    {
        queryStr: "?country=East%20Asia%20%26%20Pacific",
        params: { country: "East Asia & Pacific" },
    },
    { queryStr: "?foo=%2526", params: { foo: "%26" } },
    { queryStr: "?foo=", params: { foo: "" } },
    {
        queryStr: "?foo",
        params: { foo: undefined },
        ignoreInToQueryStrTest: true,
    },
]

describe(queryParamsToStr, () => {
    for (const testCase of testCases) {
        if (testCase.ignoreInToQueryStrTest) continue

        it(`can convert query params to a query string: '${testCase.queryStr}'`, () => {
            expect(queryParamsToStr(testCase.params)).toEqual(testCase.queryStr)
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
