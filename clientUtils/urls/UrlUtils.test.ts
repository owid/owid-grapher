#! /usr/bin/env jest

import { queryParamsToStr, strToQueryParams } from "./UrlUtils"

const testCases = [
    {
        queryStr: "?foo=bar",
        queryParams: { foo: "bar" },
        encodedQueryParams: { foo: "bar" },
    },
    {
        queryStr: "?foo=bar&baz=false&bar=0",
        queryParams: { foo: "bar", baz: "false", bar: "0" },
        encodedQueryParams: { foo: "bar", baz: "false", bar: "0" },
    },
    {
        queryStr: "?country=East+Asia+%26+Pacific",
        encodedQueryParams: { country: "East+Asia+%26+Pacific" },
        queryParams: { country: "East Asia & Pacific" },
    },
    {
        queryStr: "?country=East%20Asia%20%26%20Pacific",
        queryParams: { country: "East Asia & Pacific" },
        encodedQueryParams: { country: "East%20Asia%20%26%20Pacific" },
        ignoreInToQueryStrTest: true,
    },
    {
        queryStr: "?foo=%2526",
        queryParams: { foo: "%26" },
        encodedQueryParams: { foo: "%2526" },
    },
    {
        queryStr: "?foo=",
        queryParams: { foo: "" },
        encodedQueryParams: { foo: "" },
    },
    {
        queryStr: "?foo",
        queryParams: { foo: undefined },
        encodedQueryParams: { foo: undefined },
        ignoreInToQueryStrTest: true,
    },
]

describe(queryParamsToStr, () => {
    for (const testCase of testCases) {
        if (testCase.ignoreInToQueryStrTest) continue

        it(`can convert query params to a query string: '${testCase.queryStr}'`, () => {
            expect(queryParamsToStr(testCase.queryParams)).toEqual(
                testCase.queryStr
            )
        })
    }
})

describe(strToQueryParams, () => {
    for (const testCase of testCases) {
        it(`can convert query string to a query params object: '${testCase.queryStr}'`, () => {
            expect(strToQueryParams(testCase.queryStr)).toEqual(
                testCase.queryParams
            )
            expect(strToQueryParams(testCase.queryStr, true)).toEqual(
                testCase.encodedQueryParams
            )
        })
    }
})
