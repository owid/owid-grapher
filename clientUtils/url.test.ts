#! /usr/bin/env jest

import { queryParamsToStr, strToQueryParams } from "./url"

it("encodes correctly", () => {
    const pairs = [
        {
            str: "?foo=bar",
            params: {
                foo: "bar",
            },
        },
    ]

    pairs.forEach((pair) => {
        expect(queryParamsToStr(pair.params)).toEqual(pair.str)
        expect(strToQueryParams(pair.str)).toEqual(pair.params)
    })
})
